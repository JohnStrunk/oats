import { throwIfAborted, withTimeout } from './session-data-limits.js'

export const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error)

const dedupeByID = (items) => {
  const seen = new Set()
  const result = []
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

export async function getSession(client, sessionID, limits, signal) {
  throwIfAborted(signal)
  const controller = new AbortController()
  try {
    const info = await withTimeout(
      client.session.get({ sessionID }, { signal: controller.signal }),
      limits.timeoutMs,
      () => controller.abort(),
      signal,
    )
    throwIfAborted(signal)
    return { info }
  } catch (error) {
    return {
      failure: {
        operation: 'session.get',
        sessionID,
        message: errorMessage(error),
      },
    }
  }
}

export async function listChildren(client, parentID, limits, signal) {
  throwIfAborted(signal)
  const children = []
  const seenCursors = new Set()
  let cursor
  let failure = null
  let pages = 0
  for (;;) {
    throwIfAborted(signal)
    let response
    const controller = new AbortController()
    try {
      // The real cursor contract does not accept an order together with a
      // cursor. Ordering applies to the first page only.
      response = await withTimeout(
        client.session.list(
          cursor == null ? { parentID, order: 'asc' } : { parentID, cursor },
          { signal: controller.signal },
        ),
        limits.timeoutMs,
        () => controller.abort(),
        signal,
      )
      throwIfAborted(signal)
    } catch (error) {
      failure = {
        operation: 'session.list',
        sessionID: parentID,
        cursor,
        message: errorMessage(error),
      }
      break
    }
    pages += 1
    const page = response?.data ?? []
    for (const session of page) {
      if (session?.id) children.push(session)
    }
    // v2.0.32 can leave cursor.next set after the last page.
    if (page.length === 0) break
    const next = response?.cursor?.next ?? null
    if (next == null) break
    const token = String(next)
    if (seenCursors.has(token)) {
      failure = {
        operation: 'session.list',
        sessionID: parentID,
        cursor: token,
        message: 'paginated read repeated a cursor before completion',
      }
      break
    }
    if (pages >= limits.maxPages) {
      failure = {
        operation: 'session.list',
        sessionID: parentID,
        cursor: token,
        message: 'paginated read exceeded the page limit',
      }
      break
    }
    seenCursors.add(token)
    cursor = next
  }
  return { children: dedupeByID(children), ...(failure ? { failure } : {}) }
}

export async function listMessages(client, sessionID, limits, signal) {
  throwIfAborted(signal)
  const messages = []
  const seenCursors = new Set()
  let cursor
  let failure = null
  let pages = 0
  try {
    for (;;) {
      throwIfAborted(signal)
      let response
      const controller = new AbortController()
      try {
        response = await withTimeout(
          client.message.list(
            cursor == null
              ? { sessionID, order: 'asc' }
              : { sessionID, cursor },
            { signal: controller.signal },
          ),
          limits.timeoutMs,
          () => controller.abort(),
          signal,
        )
        throwIfAborted(signal)
      } catch (error) {
        failure = {
          operation: 'message.list',
          sessionID,
          cursor,
          message: errorMessage(error),
        }
        break
      }
      pages += 1
      const page = response?.data ?? []
      for (const message of page) {
        if (message?.id) messages.push(message)
      }
      // v2.0.32 can leave cursor.next set after the last page.
      if (page.length === 0) break
      const next = response?.cursor?.next ?? null
      if (next == null) break
      const token = String(next)
      if (seenCursors.has(token)) {
        failure = {
          operation: 'message.list',
          sessionID,
          cursor: token,
          message: 'paginated read repeated a cursor before completion',
        }
        break
      }
      if (pages >= limits.maxPages) {
        failure = {
          operation: 'message.list',
          sessionID,
          cursor: token,
          message: 'paginated read exceeded the page limit',
        }
        break
      }
      seenCursors.add(token)
      cursor = next
    }
  } catch (error) {
    failure = {
      operation: 'message.list',
      sessionID,
      cursor,
      message: errorMessage(error),
    }
  }
  return { messages: dedupeByID(messages), ...(failure ? { failure } : {}) }
}

const advanceSequence = (state, item) => {
  if (!item?.durable) return
  if (typeof item.durable.seq !== 'number') {
    state.sequenceKnown = false
    return
  }
  if (state.lastSeq != null && item.durable.seq !== state.lastSeq + 1) {
    state.contiguous = false
  }
  state.lastSeq = item.durable.seq
}

const finishCompaction = (state, complete, incomplete, sawEnd) => {
  if (!state || state.calls.length === 0) return
  if (sawEnd && state.sequenceKnown && state.contiguous) complete.push(state)
  else incomplete.push(state)
}

// shortcut: v2.0.32 does not persist durable events by default, so only
// session.usage.recorded entries are read back; older step retry attempts are
// not reconstructed from the log. Upgrade when the host exposes full logs.
export async function readSessionLog(client, sessionID, limits, signal) {
  throwIfAborted(signal)
  const events = []
  const completeCompactions = []
  const incompleteCompactions = []
  let active = null
  let synced = false
  let failure = null
  if (typeof client?.session?.log !== 'function') {
    return { events, summarizedCompactions: [], incompleteCompactions, synced }
  }

  const controller = new AbortController()
  let iterator
  try {
    iterator = client
      .session.log({ sessionID, follow: false }, { signal: controller.signal })
      [Symbol.asyncIterator]()
    let count = 0
    for (;;) {
      throwIfAborted(signal)
      const next = await withTimeout(
        iterator.next(),
        limits.timeoutMs,
        () => controller.abort(),
        signal,
      )
      throwIfAborted(signal)
      if (next.done) break
      count += 1
      if (count > limits.maxLogEvents) {
        failure = {
          operation: 'session.log',
          sessionID,
          message: 'event log exceeded the event limit',
        }
        break
      }
      const item = next.value
      if (item.type === 'log.synced') {
        synced = true
        continue
      }
      const payload = item.data
      if (payload?.sessionID !== sessionID) continue
      if (item.type === 'session.compaction.started') {
        finishCompaction(
          active,
          completeCompactions,
          incompleteCompactions,
          false,
        )
        // Automatic compactions may omit inputID. The start event identity is
        // the stable projection identity in that case.
        const seq = item.durable?.seq
        active = {
          sessionID,
          id: payload.inputID ?? item.id ?? null,
          startedAt: typeof item.created === 'number' ? item.created : null,
          calls: [],
          startSeq: typeof seq === 'number' ? seq : null,
          lastSeq: typeof seq === 'number' ? seq : null,
          sequenceKnown: typeof seq === 'number',
          contiguous: true,
          endSeq: null,
          endedAt: null,
        }
        continue
      }
      if (active) advanceSequence(active, item)
      if (item.type === 'session.usage.recorded') {
        events.push(item)
        if (active && payload.source === 'compaction') {
          active.calls.push({
            eventID: item.id,
            cost: typeof payload.cost === 'number' ? payload.cost : null,
            tokens: payload.tokens ?? null,
          })
        }
        continue
      }
      if (
        item.type === 'session.compaction.ended' ||
        item.type === 'session.compaction.failed'
      ) {
        if (active) {
          active.endSeq =
            typeof item.durable?.seq === 'number' ? item.durable.seq : null
          active.endedAt =
            typeof item.created === 'number' ? item.created : null
        }
        finishCompaction(
          active,
          completeCompactions,
          incompleteCompactions,
          true,
        )
        active = null
      }
    }
  } catch (error) {
    failure = {
      operation: 'session.log',
      sessionID,
      message: errorMessage(error),
    }
  } finally {
    // Do not await return(): an idle SSE generator may be parked forever.
    try {
      const returned = iterator?.return?.()
      returned?.catch?.(() => {})
    } catch {
      // Cleanup is best-effort.
    }
  }

  finishCompaction(
    active,
    completeCompactions,
    incompleteCompactions,
    false,
  )
  const logComplete = synced && !failure
  // A log that did not report log.synced is not proof that a compaction's
  // call set is complete. Keep the reported summary in that case.
  const complete = logComplete ? completeCompactions : []
  const incomplete = [
    ...incompleteCompactions,
    ...(logComplete ? [] : completeCompactions),
  ].map(({ sessionID: id, id: compactionID, startedAt, calls, startSeq, endSeq, endedAt }) => ({
    sessionID: id,
    id: compactionID,
    startedAt,
    calls,
    startSeq,
    endSeq,
    endedAt,
  }))
  return {
    events,
    summarizedCompactions: complete.map(
      ({ sessionID: id, id: compactionID, startedAt, calls, startSeq, endSeq, endedAt }) => ({
        sessionID: id,
        id: compactionID,
        startedAt,
        calls,
        startSeq,
        endSeq,
        endedAt,
      }),
    ),
    incompleteCompactions: incomplete,
    synced: logComplete,
    ...(failure ? { failure } : {}),
  }
}
