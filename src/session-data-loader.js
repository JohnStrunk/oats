import { throwIfAborted } from './session-data-limits.js'
import { buildMessageRecords } from './session-data-records.js'
import {
  getSession,
  listChildren,
  listMessages,
  readSessionLog,
} from './session-data-source.js'

const mergeChildren = (fetched, fallback) => {
  const byID = new Map()
  for (const child of [...fetched, ...fallback]) {
    if (child?.id && !byID.has(child.id)) byID.set(child.id, child)
  }
  return [...byID.values()]
}

// Reads one displayed-session subtree. Failures are returned as data so the
// caller can preserve previously known records and retry them on refresh.
export async function loadScope(
  client,
  rootSessionID,
  fallbackChildren,
  knownForks,
  limits,
  previousScope = new Set(),
  signal,
) {
  const result = {
    sessionID: rootSessionID,
    scope: new Set([rootSessionID]),
    order: [],
    children: new Map(),
    records: new Map(),
    status: new Map(),
    info: new Map(),
    staleInfo: new Set(),
    errors: [],
    gaps: [],
    usageEvents: [],
    summarizedCompactions: [],
    supersededUsageEventIDs: [],
    forks: new Set(),
  }

  const previousVerifiedLinks =
    fallbackChildren?.verifiedLinks instanceof Map
      ? fallbackChildren.verifiedLinks
      : new Map()

  throwIfAborted(signal)
  const rootLookup = await getSession(client, rootSessionID, limits, signal)
  throwIfAborted(signal)
  if (rootLookup.failure) {
    result.errors.push(rootLookup.failure)
  } else if (rootLookup.info) {
    result.info.set(rootSessionID, rootLookup.info)
  } else {
    // Without session metadata we cannot tell whether this session is a
    // fork. Fail closed below instead of attributing possible copies.
    result.errors.push({
      operation: 'session.get',
      sessionID: rootSessionID,
      message: 'session metadata unavailable',
    })
  }

  const previousParent = new Map()
  for (const [parentID, children] of fallbackChildren) {
    for (const child of children ?? []) {
      if (child?.id) previousParent.set(child.id, parentID)
    }
  }
  // A verified parent link wins over a stale duplicate from an unverified
  // branch. This matters when a child's parent changes and the old branch
  // listing fails on a later refresh.
  for (const [childID, parentID] of previousVerifiedLinks) {
    previousParent.set(childID, parentID)
  }
  const authoritativeParents = new Map()
  const disproved = (sessionID) => {
    const seen = new Set()
    let current = sessionID
    while (previousParent.has(current)) {
      const parentID = previousParent.get(current)
      const authoritative = authoritativeParents.get(parentID)
      if (authoritative && !authoritative.has(current)) return true
      if (seen.has(parentID)) break
      seen.add(parentID)
      current = parentID
    }
    return false
  }
  const queue = [rootSessionID]
  let traversalComplete = true
  let traversalIncomplete = false
  while (queue.length > 0 && traversalComplete) {
    throwIfAborted(signal)
    const parentID = queue.shift()
    result.order.push(parentID)
    const listing = await listChildren(client, parentID, limits, signal)
    throwIfAborted(signal)
    let children = listing.children
    let metadataTrusted = true
    const parentStale = result.staleInfo.has(parentID)
    if (listing.failure) {
      result.errors.push(listing.failure)
      // Fallback metadata was proven by an earlier successful listing, but
      // this refresh cannot verify it. Preserve the known tree, and withhold
      // new history/log reads for those children until a listing succeeds.
      children = mergeChildren(children, fallbackChildren.get(parentID) ?? [])
      metadataTrusted = false
      traversalIncomplete = true
    } else if (parentStale) {
      // A successful child listing under an unverified parent does not prove
      // the old descendants left. Keep the previously known children so their
      // records remain in scope; they inherit the stale marking below.
      children = mergeChildren(children, fallbackChildren.get(parentID) ?? [])
    }
    if (!listing.failure && !parentStale) {
      // A successful listing under a verified parent is authoritative about
      // which previous children remain. Anything it omits is disproved.
      authoritativeParents.set(
        parentID,
        new Set(listing.children.map((child) => child.id)),
      )
    }
    const childTrusted = metadataTrusted && !parentStale
    const inherited = !metadataTrusted || parentStale
    for (const child of children) {
      if (!child?.id || result.scope.has(child.id)) continue
      if (inherited) {
        const verifiedParent = previousVerifiedLinks.get(child.id)
        if (verifiedParent && verifiedParent !== parentID) {
          // A stale duplicate link must not reattach a child whose verified
          // lineage is gone, or pre-empt a parent that is verified now.
          if (disproved(child.id)) continue
          if (authoritativeParents.has(verifiedParent)) continue
          // The verified parent was not reached this refresh. Retain the known
          // child as uncertain without traversing the stale link.
          result.scope.add(child.id)
          result.info.set(child.id, child)
          result.staleInfo.add(child.id)
          continue
        }
      }
      if (result.scope.size >= limits.maxSubtreeNodes) {
        result.errors.push({
          operation: 'session.traversal',
          sessionID: parentID,
          message: 'subtree node limit exceeded',
        })
        traversalIncomplete = true
        traversalComplete = false
        break
      }
      result.scope.add(child.id)
      result.info.set(child.id, child)
      // A descendant of an unverified link is unverified even if its own
      // listing succeeds.
      if (!childTrusted) result.staleInfo.add(child.id)
      queue.push(child.id)
    }
    // Cache every known link, including children not accepted because of the
    // node cap. A later successful ancestor listing can then prove those
    // cached children were removed instead of letting stale scope restore
    // them.
    result.children.set(parentID, children)
  }

  if (traversalIncomplete) {
    // Parents that were never reached still carry verified lineage from the
    // previous cache. Preserve those links so a later authoritative ancestor
    // listing can disprove the whole removed branch instead of orphaning a
    // retained grandchild.
    for (const [parentID, children] of fallbackChildren) {
      if (!result.children.has(parentID)) {
        result.children.set(parentID, children)
      }
    }

    // Keep previously proven scope only where this traversal could not prove
    // removal. A successful ancestor listing is authoritative for its direct
    // children, so a removed sibling (and its subtree) stays excluded.
    for (const sessionID of previousScope) {
      if (result.scope.has(sessionID) || disproved(sessionID)) continue
      result.scope.add(sessionID)
      result.staleInfo.add(sessionID)
    }
    result.gaps.push({
      kind: 'subtree-scope-incomplete',
      sessionID: rootSessionID,
    })
  }

  const verifiedLinks = new Map()
  for (const [parentID, childIDs] of authoritativeParents) {
    for (const childID of childIDs) verifiedLinks.set(childID, parentID)
  }
  if (traversalIncomplete) {
    for (const [childID, parentID] of previousVerifiedLinks) {
      if (authoritativeParents.has(parentID)) {
        // A successful parent listing is authoritative even when it omits
        // this child; do not retain the old verified link.
        continue
      }
      // A freshly verified parent always wins over an older unverified link.
      if (verifiedLinks.has(childID)) continue
      verifiedLinks.set(childID, parentID)
    }
  }
  // Keep verified parents last so insertion-order fallbacks also prefer them.
  for (const parentID of authoritativeParents.keys()) {
    if (!result.children.has(parentID)) continue
    const children = result.children.get(parentID)
    result.children.delete(parentID)
    result.children.set(parentID, children)
  }
  Object.defineProperty(result.children, 'verifiedLinks', {
    value: verifiedLinks,
    enumerable: false,
    configurable: true,
  })


  for (const sessionID of result.order) {
    const info = result.info.get(sessionID)
    if (info?.fork || knownForks.has(sessionID)) {
      // V2.0.32 forks copy messages under new IDs, so the fork boundary
      // cannot prove which rows are copied. Withhold all of this session's
      // history rather than attributing copies to the displayed subtree.
      // Child sessions are not copies and are still traversed below.
      result.forks.add(sessionID)
      result.gaps.push({
        kind: 'fork-provenance-uncertain',
        sessionID,
        reason: 'fork-history-withheld',
      })
      result.status.set(sessionID, 'complete')
      continue
    }

    if (!result.info.has(sessionID)) {
      // Provenance is unprovable, not a confirmed fork. Withhold this
      // session's history and log for this refresh, keep previously proven
      // records, and retry the lookup on the next refresh.
      result.gaps.push({
        kind: 'fork-provenance-uncertain',
        sessionID,
        reason: 'provenance-unavailable',
      })
      result.status.set(sessionID, 'failed')
      continue
    }

    if (result.staleInfo.has(sessionID)) {
      // A failed listing leaves the known tree intact but does not prove that
      // this child's metadata is current. Do not load new history from it.
      result.gaps.push({
        kind: 'session-metadata-stale',
        sessionID,
      })
      result.status.set(sessionID, 'failed')
      continue
    }

    throwIfAborted(signal)
    const history = await listMessages(client, sessionID, limits, signal)
    throwIfAborted(signal)
    const usage = await readSessionLog(client, sessionID, limits, signal)
    throwIfAborted(signal)
    const logComplete = usage.synced && !usage.failure
    const summarized = logComplete ? usage.summarizedCompactions : []
    const records = buildMessageRecords(
      sessionID,
      history.messages,
      summarized,
    )
    for (const [key, record] of records) result.records.set(key, record)
    result.status.set(
      sessionID,
      history.failure
        ? history.messages.length > 0
          ? 'partial'
          : 'failed'
        : 'complete',
    )
    if (history.failure) result.errors.push(history.failure)

    if (!logComplete || usage.events.length === 0) {
      result.gaps.push({
        kind: 'historical-usage-unavailable',
        sessionID,
      })
    }
    if (usage.failure) result.errors.push(usage.failure)
    const superseded = new Set()
    const supersededKeys = []
    for (const entry of usage.incompleteCompactions ?? []) {
      for (const call of entry.calls ?? []) {
        if (call.eventID) {
          superseded.add(call.eventID)
          supersededKeys.push({
            sessionID: entry.sessionID,
            eventID: call.eventID,
          })
        }
      }
      result.gaps.push({
        kind: 'compaction-usage-incomplete',
        sessionID: entry.sessionID,
        messageID: entry.id,
        startedAt: entry.startedAt,
        calls: entry.calls,
      })
    }
    result.supersededUsageEventIDs.push(...supersededKeys)
    result.usageEvents.push(
      ...usage.events.filter((event) => !superseded.has(event.id)),
    )
    result.summarizedCompactions.push(...summarized)

    // v2.0.32 does not persist step attempts reliably. Even a populated usage
    // log does not prove that retries were captured, so this remains a gap.
    result.gaps.push({ kind: 'retry-history-unavailable', sessionID })
  }

  return result
}
