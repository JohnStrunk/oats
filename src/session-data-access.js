import { createEffect, createRoot } from 'solid-js'
import { loadScope } from './session-data-loader.js'
import { resolveLimits } from './session-data-limits.js'
import {
  cloneModel,
  cloneTokens,
  latestAttempt,
  mergeHistoryIntoRecord,
  messageKey,
  numberOrNull,
  recordGaps,
  sameUsage,
} from './session-data-records.js'
import { errorMessage } from './session-data-source.js'

// OpenCode v2.0.32 settles usage per step, but does not persist durable events
// by default. Historical usage that only exists as an event (for example title
// and compaction calls) is therefore reported as a gap, not reconstructed from
// the current session configuration.
const LIVE_EVENT_TYPES = [
  'session.step.started',
  'session.step.ended',
  'session.step.failed',
  'session.compaction.started',
  'session.compaction.ended',
  'session.compaction.failed',
]

const ROUTE_HINT_EVENTS = new Set(['session.viewed', 'tui.session.select'])
const STRUCTURE_EVENTS = new Set([
  'session.created',
  'session.deleted',
  'session.forked',
  'session.moved',
])

export function createSessionDataAccess(context) {
  const client = context?.client
  const data = context?.data
  const router = context?.ui?.router
  const limits = resolveLimits(context)

  let disposed = false
  let generation = 0
  let requestedSessionID = null
  let loading = false
  let activePromise = null
  let activeController = null
  let trailingRefresh = false

  let committedSessionID = null
  let committedScope = new Set()
  const scopeBySession = new Map()
  const childrenBySession = new Map()
  let errors = []
  let gaps = []

  // Records survive refreshes so a failed page or session never discards data
  // that was already known. The snapshot only includes the current scope.
  const historyRecords = new Map()
  const attemptsByMessage = new Map()
  const pendingIdentity = new Map()
  const usageRecords = new Map()
  const liveCompactions = new Map()
  const pendingCompactionID = new Map()
  let committedSummarizedCompactions = []
  const committedCompleteCallEventIDs = new Set()
  const processedEventIDs = new Set()
  const seenEventObjects = new WeakSet()
  // Message keys whose historical usage was known before a later live retry.
  // Those records are prior attempts, not aggregates of the live attempt.
  const priorAttemptKeys = new Set()

  // Fork detection is sticky: a failed session lookup on a later refresh must
  // not make previously withheld fork history appear to be own work.
  let knownForkSessions = new Set()

  const unsubscribers = []
  let disposeReactive = () => {}

  function readDisplayedSessionID() {
    try {
      const route = router?.current?.()
      // Read both fields explicitly. A Solid store-backed route only tracks
      // the properties that are accessed while the effect runs.
      const type = route?.type
      const sessionID = type === 'session' ? route?.sessionID : undefined
      return type === 'session' && typeof sessionID === 'string'
        ? sessionID
        : null
    } catch {
      return null
    }
  }

  function isInActiveScope(sessionID) {
    // During a load the subtree is not committed yet. Retain settlements for
    // any session and let snapshot composition expose only the current scope.
    return loading || sessionID === requestedSessionID || committedScope.has(sessionID)
  }

  // --- Commit ------------------------------------------------------------

  function upsertUsageEvent(event) {
    const payload = event?.data
    if (!payload?.sessionID || usageRecords.has(event.id)) return
    // Historical event records cannot be proven own for a fork: the log may
    // include usage copied from the source session.
    if (knownForkSessions.has(payload.sessionID)) return
    usageRecords.set(event.id, {
      id: `${payload.sessionID}/usage:${event.id}`,
      sessionID: payload.sessionID,
      messageID: null,
      agent: null,
      model: null,
      cost: numberOrNull(payload.cost),
      tokens: cloneTokens(payload.tokens),
      source: payload.source,
      provenance: 'session',
      origin: 'history',
      createdAt: numberOrNull(event.created),
      seq: numberOrNull(event.durable?.seq),
      eventID: event.id,
    })
  }

  function matchesSummarized(record) {
    return committedSummarizedCompactions.some(
      (entry) =>
        entry.sessionID === record.sessionID &&
        ((entry.id != null &&
          (entry.id === record.id || entry.id === record.messageID)) ||
          (entry.startedAt != null && entry.startedAt === record.startedAt)),
    )
  }

  function commit(result) {
    // A retry that has started but not settled may already have rewritten the
    // host projection's identity while leaving the earlier usage in place.
    // Keep the settled prior record authoritative until the retry terminal.
    for (const [key, pending] of pendingIdentity) {
      const existing = historyRecords.get(key)
      if (!existing || (existing.cost == null && existing.tokens == null)) {
        continue
      }
      const identityChanged =
        (pending.agent != null &&
          existing.agent != null &&
          pending.agent !== existing.agent) ||
        (pending.model != null &&
          existing.model != null &&
          (pending.model.providerID !== existing.model.providerID ||
            pending.model.id !== existing.model.id))
      if (existing.completedAt != null || identityChanged) {
        priorAttemptKeys.add(key)
      }
    }

    // Index the refresh once instead of rescanning every accumulated record
    // per session. Committing runs on the TUI thread, so this must stay linear
    // in the number of sessions and records.
    const completeSessions = new Set()
    for (const sessionID of result.order) {
      if (result.status.get(sessionID) === 'complete') {
        completeSessions.add(sessionID)
      }
    }
    const recordsBySession = new Map()
    for (const [key, record] of result.records) {
      const records = recordsBySession.get(record.sessionID)
      if (records) records.push([key, record])
      else recordsBySession.set(record.sessionID, [[key, record]])
    }

    // A complete session replaces its retained history. Deletion depends only
    // on the record's own session, so one pass is equivalent to doing it
    // before each session's records.
    if (completeSessions.size > 0) {
      for (const [key, record] of historyRecords) {
        // A record observed before a later live retry is a prior attempt, not
        // an aggregate to replace.
        if (
          completeSessions.has(record.sessionID) &&
          !priorAttemptKeys.has(key)
        ) {
          historyRecords.delete(key)
        }
      }
    }

    for (const sessionID of result.order) {
      const sessionRecords = recordsBySession.get(sessionID)
      if (!sessionRecords) continue
      for (const [key, record] of sessionRecords) {
        if (pendingIdentity.has(key) && priorAttemptKeys.has(key)) {
          // The retry is still running. Its projection identity and retained
          // old usage are ambiguous; keep the prior settled record.
          result.gaps.push({
            kind: 'retry-usage-ambiguous',
            sessionID,
            messageID: record.messageID,
          })
          continue
        }
        const attempts = attemptsByMessage.get(key)
        if (!attempts || attempts.size === 0) {
          historyRecords.set(key, record)
          continue
        }

        // Associate by completion chronology, not by "newest attempt". A
        // history response that arrives after a live retry is a separate
        // prior attempt unless its completion identifies a specific attempt.
        let matching = null
        if (record.completedAt != null) {
          for (const attempt of attempts.values()) {
            if (attempt.terminalAt === record.completedAt) {
              matching = attempt
              break
            }
          }
        }
        const knownUsage = record.cost != null || record.tokens != null
        if (matching) {
          // A failed retry projection can retain the prior attempt's usage.
          // Never fill usage into a failed attempt; keep the known history as
          // a separate prior record when it carries usage.
          const failedAttempt = matching.terminalType === 'session.step.failed'
          const includeUsage = !failedAttempt && !priorAttemptKeys.has(key)
          mergeHistoryIntoRecord(matching, record, includeUsage)
          if (failedAttempt && knownUsage) {
            priorAttemptKeys.add(key)
            if (!historyRecords.has(key)) historyRecords.set(key, record)
          } else if (!priorAttemptKeys.has(key)) {
            historyRecords.delete(key)
          }
        } else if (knownUsage) {
          // Ambiguous or earlier history stays a distinct prior attempt. Never
          // copy its usage onto a retry.
          priorAttemptKeys.add(key)
          if (!historyRecords.has(key)) historyRecords.set(key, record)
        } else {
          const latest = latestAttempt(attempts)
          if (latest) mergeHistoryIntoRecord(latest, record)
          if (!priorAttemptKeys.has(key)) historyRecords.delete(key)
        }
      }
    }

    committedSessionID = result.sessionID
    committedScope = result.scope
    scopeBySession.set(result.sessionID, result.scope)
    childrenBySession.set(result.sessionID, result.children)
    for (const sessionID of result.forks) knownForkSessions.add(sessionID)
    // Complete call-set knowledge is retained for the service lifetime. A
    // later missing or partial log must not make a previously suppressed
    // summary countable again while its committed calls are still present.
    for (const entry of result.summarizedCompactions ?? []) {
      const known = committedSummarizedCompactions.some(
        (candidate) =>
          candidate.sessionID === entry.sessionID &&
          candidate.id === entry.id &&
          candidate.startedAt === entry.startedAt,
      )
      if (!known) committedSummarizedCompactions.push(entry)
      for (const call of entry.calls ?? []) {
        if (call.eventID) {
          committedCompleteCallEventIDs.add(
            `${entry.sessionID}|${call.eventID}`,
          )
        }
      }
    }
    errors = result.errors
    gaps = result.gaps

    // Fully accounted compaction summaries are replaced by their individual
    // logged calls. Drop any live summary record for the same operation.
    for (const [id, record] of liveCompactions) {
      if (matchesSummarized(record)) liveCompactions.delete(id)
    }

    // Withheld fork history must not linger from an earlier load, and
    // historical event-only usage for a fork cannot be separated from copied
    // usage. Live-witnessed records for the fork remain available.
    for (const [key, record] of historyRecords) {
      if (knownForkSessions.has(record.sessionID)) historyRecords.delete(key)
    }
    for (const [eventID, record] of usageRecords) {
      if (
        record.origin === 'history' &&
        knownForkSessions.has(record.sessionID)
      ) {
        usageRecords.delete(eventID)
      }
    }

    for (const event of result.usageEvents) upsertUsageEvent(event)
    // Partial constituent calls are preserved in the incomplete-compaction
    // gap, not as individually countable records. Calls already proven by a
    // complete log remain countable even if this refresh's log is partial.
    for (const entry of result.supersededUsageEventIDs ?? []) {
      const key = `${entry.sessionID}|${entry.eventID}`
      if (!committedCompleteCallEventIDs.has(key)) {
        usageRecords.delete(entry.eventID)
      }
    }
  }

  function commitEmpty() {
    committedSessionID = null
    committedScope = new Set()
    errors = []
    gaps = []
  }

  function preparePresentation(sessionID) {
    if (sessionID === committedSessionID) return
    // A route change must not leave the previous session's snapshot visible
    // while the new session loads. Present no session until the new load
    // commits; stored records remain available for a later return or a
    // partial same-session load.
    committedSessionID = null
    committedScope = new Set()
    errors = []
    gaps = [{ kind: 'session-load-in-progress', sessionID }]
  }

  function startRefresh(forced) {
    if (disposed) return Promise.resolve()
    if (!forced && activePromise) {
      trailingRefresh = true
      return activePromise
    }

    // A forced refresh (route change or explicit call) supersedes the active
    // traversal immediately.
    if (activeController) {
      activeController.abort()
      activeController = null
    }
    trailingRefresh = false

    const run = ++generation
    const sessionID = readDisplayedSessionID()
    requestedSessionID = sessionID
    if (sessionID == null) {
      loading = false
      activePromise = null
      commitEmpty()
      return Promise.resolve()
    }

    preparePresentation(sessionID)
    const previousScope = scopeBySession.get(sessionID) ?? new Set()
    const previousChildren = childrenBySession.get(sessionID) ?? new Map()
    const controller = new AbortController()
    activeController = controller
    loading = true
    let promise
    promise = loadScope(
      client,
      sessionID,
      previousChildren,
      knownForkSessions,
      limits,
      previousScope,
      controller.signal,
    )
      .catch((error) => ({
        sessionID,
        scope: new Set([sessionID]),
        order: [sessionID],
        children: new Map(),
        records: new Map(),
        status: new Map(),
        info: new Map(),
        errors: [
          {
            operation: 'refresh',
            sessionID,
            message: errorMessage(error),
          },
        ],
        gaps: [],
        usageEvents: [],
        summarizedCompactions: [],
        supersededUsageEventIDs: [],
        forks: new Set(),
      }))
      .then((result) => {
        if (disposed || run !== generation) return
        loading = false
        activeController = null
        commit(result)
      })
      .finally(() => {
        if (activePromise !== promise) return
        activePromise = null
        activeController = null
        if (trailingRefresh && !disposed) {
          trailingRefresh = false
          void startRefresh(false)
        }
      })
    activePromise = promise
    return promise
  }

  function refresh() {
    return startRefresh(true)
  }

  function scheduleRefresh() {
    if (disposed) return
    if (activePromise) {
      trailingRefresh = true
      return
    }
    void startRefresh(false)
  }

  // --- Live updates ------------------------------------------------------

  function rememberEvent(event) {
    if (event?.id != null) {
      if (processedEventIDs.has(event.id)) return false
      processedEventIDs.add(event.id)
      return true
    }
    if (seenEventObjects.has(event)) return false
    seenEventObjects.add(event)
    return true
  }

  function handleStepStarted(event) {
    const payload = event?.data
    if (!payload?.sessionID || !payload?.assistantMessageID) return
    if (!isInActiveScope(payload.sessionID)) return
    const key = messageKey(payload.sessionID, payload.assistantMessageID)
    const identity = {
      agent: payload.agent ?? null,
      model: cloneModel(payload.model),
    }
    // A start belongs to the attempt that will follow it. Do not backfill the
    // identity onto earlier attempts or historical records: a retry's agent
    // and model are not evidence for work that started earlier.
    pendingIdentity.set(key, identity)
  }

  function handleStepTerminal(event) {
    const payload = event?.data
    if (!payload?.sessionID || !payload?.assistantMessageID) return
    if (!isInActiveScope(payload.sessionID)) return
    if (!rememberEvent(event)) return

    const sessionID = payload.sessionID
    const messageID = payload.assistantMessageID
    const key = messageKey(sessionID, messageID)
    const identity = pendingIdentity.get(key) ?? null
    const historical = historyRecords.get(key)
    const failed = event?.type === 'session.step.failed'
    // A live terminal whose wall-clock completion matches the historical
    // message describes the same attempt. It replaces the history record. A
    // failed terminal never settles historical usage: the projection may still
    // carry the previous attempt's values.
    const sameAttempt =
      !failed &&
      historical != null &&
      typeof historical.completedAt === 'number' &&
      typeof event?.created === 'number' &&
      historical.completedAt === event.created

    // Otherwise a historical record with known usage is an earlier attempt. A
    // later live terminal event is a retry, so keep the known record. A
    // historical record without usage is settled by this event and replaced.
    const historicalIsPrior =
      historical != null &&
      !sameAttempt &&
      (historical.cost != null || historical.tokens != null)
    let historicalIdentity = historical
    let settledHistorical = null
    if (historicalIsPrior) {
      priorAttemptKeys.add(key)
      historicalIdentity = null
    } else if (historical) {
      historyRecords.delete(key)
      if (sameAttempt) settledHistorical = historical
    }

    let attempts = attemptsByMessage.get(key)
    if (!attempts) {
      attempts = new Map()
      attemptsByMessage.set(key, attempts)
    }
    const attemptID = event.id ?? `${attempts.size}`
    attempts.set(attemptID, {
      id: `${key}#${attemptID}`,
      sessionID,
      messageID,
      agent: identity?.agent ?? historicalIdentity?.agent ?? null,
      model: identity?.model ?? historicalIdentity?.model ?? null,
      cost: numberOrNull(payload.cost) ?? settledHistorical?.cost ?? null,
      tokens: cloneTokens(payload.tokens) ?? settledHistorical?.tokens ?? null,
      source: 'step',
      // A live terminal event is witnessed execution, even in a fork whose
      // historical messages are withheld.
      provenance: 'own',
      origin: 'live',
      terminalType: event.type,
      terminalAt:
        typeof event?.created === 'number' ? event.created : null,
      seq:
        typeof event?.durable?.seq === 'number'
          ? event.durable.seq
          : typeof event?.created === 'number'
            ? event.created
            : 0,
    })
    // A subsequent terminal event without its own start must not inherit this
    // attempt's identity.
    pendingIdentity.delete(key)
  }

  function handleCompactionStarted(event) {
    const payload = event?.data
    if (!payload?.sessionID) return
    if (!isInActiveScope(payload.sessionID)) return
    pendingCompactionID.set(payload.sessionID, {
      // Automatic compactions may omit inputID; the start event identity is
      // the projection identity in that case.
      projectionID: payload.inputID ?? event.id ?? null,
      startedAt: typeof event.created === 'number' ? event.created : null,
      startSeq: numberOrNull(event.durable?.seq),
    })
  }

  function handleCompactionTerminal(event) {
    const payload = event?.data
    if (!payload?.sessionID) return
    if (!isInActiveScope(payload.sessionID)) return
    if (!rememberEvent(event)) return

    const sessionID = payload.sessionID
    const pending = pendingCompactionID.get(sessionID) ?? null
    pendingCompactionID.delete(sessionID)
    const messageID = payload.inputID ?? pending?.projectionID ?? null
    const startedAt = pending?.startedAt ?? null

    const id = messageID
      ? messageKey(sessionID, messageID)
      : `${sessionID}/compaction:${event.id}`
    const previous = liveCompactions.get(id)
    liveCompactions.set(id, {
      id,
      sessionID,
      messageID,
      agent: null,
      model: null,
      cost: numberOrNull(payload.cost) ?? previous?.cost ?? null,
      tokens: cloneTokens(payload.tokens) ?? previous?.tokens ?? null,
      source: 'compaction',
      // A live compaction summary is witnessed execution, even in a fork
      // whose historical messages are withheld.
      provenance: 'own',
      origin: 'live',
      startedAt: startedAt ?? previous?.startedAt ?? null,
      completedAt:
        typeof event.created === 'number' ? event.created : null,
      startSeq: pending?.startSeq ?? previous?.startSeq ?? null,
      endSeq: numberOrNull(event.durable?.seq) ?? previous?.endSeq ?? null,
      eventID: event.id,
    })
  }

  function handleHostEvent(listenerEvent) {
    if (disposed) return
    const event = listenerEvent?.details
    if (!event) return

    if (ROUTE_HINT_EVENTS.has(event.type)) {
      syncDisplayed()
      return
    }
    if (!STRUCTURE_EVENTS.has(event.type)) {
      if (readDisplayedSessionID() !== committedSessionID) syncDisplayed()
      return
    }

    if (event.type === 'session.created') {
      const parentID = event.data?.parentID
      if (parentID != null && isInActiveScope(parentID)) {
        scheduleRefresh()
      } else if (readDisplayedSessionID() !== committedSessionID) {
        syncDisplayed()
      }
      return
    }
    scheduleRefresh()
  }

  function syncDisplayed() {
    if (disposed) return
    const displayed = readDisplayedSessionID()
    if (displayed === requestedSessionID && loading) return
    if (displayed === committedSessionID && !loading) return
    void refresh()
  }

  function processLiveEvent(type, event) {
    if (type === 'session.step.started') handleStepStarted(event)
    else if (type.startsWith('session.compaction.')) {
      if (type === 'session.compaction.started') {
        handleCompactionStarted(event)
      } else {
        handleCompactionTerminal(event)
      }
    } else handleStepTerminal(event)
  }

  function subscribe() {
    if (typeof data?.on === 'function') {
      for (const type of LIVE_EVENT_TYPES) {
        try {
          unsubscribers.push(
            data.on(type, (event) => {
              if (disposed) return
              const sessionID = event?.data?.sessionID
              if (!sessionID) return
              try {
                if (isInActiveScope(sessionID)) {
                  processLiveEvent(type, event)
                }
              } catch {
                // Live notifications are best-effort; a malformed event must
                // not break the dataset or the host.
              }
            }),
          )
        } catch {
          // The host may not expose every event type.
        }
      }
    }
    if (typeof data?.listen === 'function') {
      try {
        unsubscribers.push(
          data.listen((event) => {
            if (disposed) return
            try {
              handleHostEvent(event)
            } catch {
              // See above: ignore malformed host notifications.
            }
          }),
        )
      } catch {
        // Listening to all events is optional.
      }
    }
  }

  // --- Public surface ----------------------------------------------------

  function liveMatchesHistory(live, historical) {
    if (live.sessionID !== historical.sessionID) return false
    if (live.messageID && live.messageID === historical.messageID) return true
    return (
      live.startedAt != null &&
      historical.startedAt != null &&
      live.startedAt === historical.startedAt
    )
  }

  function mergeLiveWithHistory(live, historical) {
    return {
      ...live,
      // The history projection carries the stable message identity.
      id: historical.id,
      messageID: historical.messageID,
      agent: live.agent ?? historical.agent,
      model: live.model ?? historical.model,
      cost: live.cost ?? historical.cost,
      tokens: live.tokens ?? historical.tokens,
      startedAt: historical.startedAt ?? live.startedAt,
      completedAt: historical.completedAt ?? live.completedAt,
    }
  }

  function usageIsDistinct(record, windows) {
    for (const window of windows) {
      if (
        record.seq != null &&
        window.startSeq != null &&
        window.endSeq != null
      ) {
        if (record.seq < window.startSeq || record.seq > window.endSeq) {
          continue
        }
        return false
      }
      if (
        record.createdAt != null &&
        window.startedAt != null &&
        window.endedAt != null
      ) {
        if (
          record.createdAt < window.startedAt ||
          record.createdAt > window.endedAt
        ) {
          continue
        }
        return false
      }
      // Without ordering evidence the call might be part of this summary.
      return false
    }
    return true
  }

  function composeRecords() {
    const records = []
    const derivedGaps = []
    const usage = []
    for (const record of usageRecords.values()) {
      if (committedScope.has(record.sessionID)) usage.push(record)
    }

    const liveRecords = []
    for (const record of liveCompactions.values()) {
      if (!committedScope.has(record.sessionID)) continue
      if (matchesSummarized(record)) continue
      liveRecords.push(record)
    }

    const historyCompactions = []
    for (const record of historyRecords.values()) {
      if (!committedScope.has(record.sessionID)) continue
      if (record.source !== 'compaction') {
        records.push(record)
      } else if (!matchesSummarized(record)) {
        historyCompactions.push(record)
      }
    }

    // A live compaction terminal and its later message projection describe the
    // same call. Prefer the projection's stable identity while keeping live
    // values that the projection did not report.
    const matchedHistory = new Set()
    const live = []
    for (const record of liveRecords) {
      const historical = historyCompactions.find(
        (candidate) =>
          !matchedHistory.has(candidate.id) &&
          liveMatchesHistory(record, candidate),
      )
      if (historical) {
        matchedHistory.add(historical.id)
        live.push(mergeLiveWithHistory(record, historical))
      } else {
        live.push(record)
      }
    }

    const consumedUsage = new Set()
    for (const record of historyCompactions) {
      if (matchedHistory.has(record.id)) continue
      // A persisted usage event describes the same call as the compaction
      // message. The message is a summary, not an additional provider call.
      const match = usage.find(
        (candidate) =>
          !consumedUsage.has(candidate.eventID) &&
          candidate.sessionID === record.sessionID &&
          candidate.source === 'compaction' &&
          candidate.createdAt != null &&
          record.startedAt != null &&
          candidate.createdAt === record.startedAt &&
          sameUsage(candidate, record),
      )
      if (match) consumedUsage.add(match.eventID)
      else records.push(record)
    }

    for (const attempts of attemptsByMessage.values()) {
      for (const attempt of attempts.values()) {
        if (committedScope.has(attempt.sessionID)) records.push(attempt)
      }
    }

    const summaryWindows = new Map()
    const addWindow = (window) => {
      if (!window?.sessionID || !committedScope.has(window.sessionID)) return
      if (!summaryWindows.has(window.sessionID)) {
        summaryWindows.set(window.sessionID, [])
      }
      summaryWindows.get(window.sessionID).push(window)
    }
    for (const entry of committedSummarizedCompactions) {
      addWindow({
        sessionID: entry.sessionID,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        startSeq: entry.startSeq,
        endSeq: entry.endSeq,
      })
    }
    // A live terminal and its matching history projection describe one
    // operation. Keep one window and prefer the strongest bounds available
    // rather than letting an incomplete history window mask a live end.
    const historyMatchedByLive = new Set()
    for (const record of liveRecords) {
      const historical = historyCompactions.find((candidate) =>
        liveMatchesHistory(record, candidate),
      )
      if (historical) historyMatchedByLive.add(historical.id)
    }
    for (const record of liveRecords) {
      if (matchesSummarized(record)) continue
      const historical = historyCompactions.find((candidate) =>
        liveMatchesHistory(record, candidate),
      )
      addWindow({
        sessionID: record.sessionID,
        startedAt: record.startedAt ?? historical?.startedAt,
        endedAt: record.completedAt ?? historical?.completedAt,
        startSeq: record.startSeq,
        endSeq: record.endSeq,
      })
    }
    for (const record of historyCompactions) {
      if (
        matchesSummarized(record) ||
        historyMatchedByLive.has(record.id)
      ) {
        continue
      }
      addWindow({
        sessionID: record.sessionID,
        startedAt: record.startedAt,
        endedAt: record.completedAt,
      })
    }

    for (const record of usage) {
      if (record.source !== 'compaction') {
        records.push(record)
        continue
      }
      if (
        committedCompleteCallEventIDs.has(
          `${record.sessionID}|${record.eventID}`,
        )
      ) {
        records.push(record)
        continue
      }
      if (consumedUsage.has(record.eventID)) {
        records.push(record)
        continue
      }
      const windows = summaryWindows.get(record.sessionID)
      if (windows && !usageIsDistinct(record, windows)) {
        // An unframed persisted call is ordered inside an already reported
        // compaction window. Preserve its usage in a gap, not as a second
        // count.
        derivedGaps.push({
          kind: 'compaction-usage-overlap',
          sessionID: record.sessionID,
          eventID: record.eventID,
          cost: record.cost,
          tokens: record.tokens,
        })
        continue
      }
      records.push(record)
    }
    for (const record of live) records.push(record)
    return { records, gaps: derivedGaps }
  }

  function getSnapshot() {
    if (disposed) {
      return {
        sessionID: null,
        records: [],
        complete: true,
        errors: [],
        gaps: [],
      }
    }
    const { records, gaps: derivedGaps } = composeRecords()
    const snapshotGaps = [
      ...gaps.map((gap) => ({ ...gap })),
      ...derivedGaps,
      ...recordGaps(records),
    ]
    return {
      sessionID: committedSessionID,
      records,
      complete: errors.length === 0 && snapshotGaps.length === 0,
      errors: errors.map((error) => ({ ...error })),
      gaps: snapshotGaps,
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    generation += 1
    loading = false
    activeController?.abort()
    activeController = null
    activePromise = null
    trailingRefresh = false
    disposeReactive()
    disposeReactive = () => {}
    for (const unsubscribe of unsubscribers.splice(0)) {
      try {
        unsubscribe?.()
      } catch {
        // Cleanup is best-effort.
      }
    }
    historyRecords.clear()
    attemptsByMessage.clear()
    pendingIdentity.clear()
    usageRecords.clear()
    liveCompactions.clear()
    pendingCompactionID.clear()
    priorAttemptKeys.clear()
    processedEventIDs.clear()
    committedSummarizedCompactions = []
    committedCompleteCallEventIDs.clear()
    scopeBySession.clear()
    childrenBySession.clear()
    commitEmpty()
  }

  subscribe()
  queueMicrotask(() => syncDisplayed())
  try {
    createRoot((disposeRoot) => {
      disposeReactive = disposeRoot
      createEffect(() => {
        // Reading the route accessor subscribes this effect to host route
        // changes. The v2.0.32 router has no change callback of its own.
        // shortcut: route hints arrive as host events too; add polling only if
        // a host release stops emitting both notifications and reactivity.
        readDisplayedSessionID()
        queueMicrotask(() => syncDisplayed())
      })
    })
  } catch {
    // Solid is inert outside a reactive root; explicit refresh still works.
  }

  return { refresh, getSnapshot, dispose }
}
