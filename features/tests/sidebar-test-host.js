import { createSignal } from 'solid-js'

// Host-side boundary fakes for the Agent stats sidebar. OATS's real plugin
// entrypoint, session-data access and aggregation run against these; only the
// OpenCode client, event stream, route and interaction surfaces are controlled.

const tokens = (n) => ({
  input: n,
  output: n + 1,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})

export const sessionInfo = (id, parentID) => ({
  id,
  ...(parentID ? { parentID } : {}),
  agent: 'current-agent',
  model: { providerID: 'provider', id: 'current-model' },
  cost: 0,
  tokens: tokens(0),
  projectID: 'project',
  time: { created: 1, updated: 1 },
  location: { directory: '/workspace' },
})

export const assistantMessage = (
  id,
  {
    agent,
    cost,
    tokenCount = 2,
    created = 1,
    completed = 2,
    model = { providerID: 'provider', id: 'model' },
  } = {},
) => ({
  id,
  type: 'assistant',
  time: {
    ...(created != null ? { created } : {}),
    ...(completed != null ? { completed } : {}),
  },
  content: [],
  model,
  ...(agent !== undefined ? { agent } : {}),
  ...(cost !== undefined ? { cost } : {}),
  ...(tokenCount !== undefined ? { tokens: tokens(tokenCount) } : {}),
})

const encode = (cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url')
const decode = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString())
  } catch {
    throw new Error('invalid cursor')
  }
}

const page = (items, query, limit) => {
  const offset = query.offset ?? 0
  const ordered = query.order === 'desc' ? [...items].reverse() : items
  return {
    data: structuredClone(ordered.slice(offset, offset + limit)),
    cursor: {
      ...(offset > 0
        ? { previous: encode({ ...query, offset: Math.max(0, offset - limit) }) }
        : {}),
      ...(offset + limit < ordered.length
        ? { next: encode({ ...query, offset: offset + limit }) }
        : {}),
    },
  }
}

export function makeSidebarHost({
  sessions = [sessionInfo('root')],
  messages = {},
  failures = [],
  initialRoute = { type: 'session', sessionID: 'root' },
} = {}) {
  const [route, setRouteSignal] = createSignal(initialRoute)
  const failed = new Set(failures)
  const listeners = new Map()
  const allListeners = new Set()
  const blocked = new Map()
  const claims = []
  const layers = []
  const toasts = []
  const calls = []

  const data = {
    on(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(callback)
      return () => listeners.get(type)?.delete(callback)
    },
    listen(callback) {
      allListeners.add(callback)
      return () => allListeners.delete(callback)
    },
  }

  const client = {
    session: {
      async get({ sessionID }) {
        const info = sessions.find((session) => session.id === sessionID)
        return info ? structuredClone(info) : undefined
      },
      async list({ parentID, cursor, order, limit = 50 } = {}) {
        if (cursor !== undefined && order !== undefined) {
          throw new Error('cursor cannot be combined with order')
        }
        const query =
          cursor === undefined
            ? { kind: 'session', parentID, order: order ?? 'asc', offset: 0 }
            : decode(cursor)
        if (query.kind !== 'session') throw new Error('cursor filter mismatch')
        calls.push(['session.list', query.parentID, query.offset])
        if (failed.has(`session.list:${query.parentID}`)) {
          throw new Error('session list unavailable')
        }
        const children = sessions.filter((session) =>
          query.parentID === undefined
            ? !session.parentID
            : session.parentID === query.parentID,
        )
        return page(children, query, limit)
      },
      async *log({ sessionID }) {
        if (failed.has(`log:${sessionID}`)) throw new Error('log unavailable')
        yield { type: 'log.synced', aggregateID: sessionID }
      },
    },
    message: {
      async list({ sessionID, cursor, order, limit = 50 } = {}) {
        if (cursor !== undefined && order !== undefined) {
          throw new Error('cursor cannot be combined with order')
        }
        const query =
          cursor === undefined
            ? { kind: 'message', sessionID, order: order ?? 'asc', offset: 0 }
            : decode(cursor)
        if (query.kind !== 'message' || query.sessionID !== sessionID) {
          throw new Error('cursor filter mismatch')
        }
        calls.push(['message.list', sessionID, query.offset])
        const gate = blocked.get(sessionID)
        if (gate) {
          gate.entered()
          await gate.promise
        }
        if (failed.has(`message.list:${sessionID}`)) {
          throw new Error('history unavailable')
        }
        return page(messages[sessionID] ?? [], query, limit)
      },
    },
  }

  const context = {
    client,
    data,
    theme: { text: { base: '#ffffff', muted: '#888888' } },
    ui: {
      router: { current: route },
      toast: {
        show(payload) {
          toasts.push(payload)
        },
      },
      slot(claim) {
        claims.push(claim)
        return () => {
          const index = claims.indexOf(claim)
          if (index >= 0) claims.splice(index, 1)
        }
      },
    },
    keymap: {
      layer(factory) {
        const layer = factory()
        layers.push(layer)
        return () => {
          const index = layers.indexOf(layer)
          if (index >= 0) layers.splice(index, 1)
        }
      },
    },
  }

  // Route changes are reactive so session-data access observes them the same
  // way it observes the host router.
  const setRoute = (next) => setRouteSignal(next)
  const displayedSessionID = () => {
    const current = route()
    return current?.type === 'session' ? current.sessionID : null
  }

  // Hold the first message read for a session so loading is observable.
  const blockHistory = (sessionID) => {
    let releaseGate
    let enterGate
    const entered = new Promise((resolve) => {
      enterGate = resolve
    })
    const promise = new Promise((resolve) => {
      releaseGate = () => {
        blocked.delete(sessionID)
        enterGate()
        resolve()
      }
    })
    blocked.set(sessionID, { promise, entered: enterGate })
    return { entered, release: releaseGate }
  }

  const emit = (event) => {
    for (const callback of listeners.get(event.type) ?? []) callback(event)
    for (const callback of allListeners) callback({ details: event })
  }

  const settleStep = (
    { sessionID = displayedSessionID(), messageID, agent = 'alpha', cost, model = { providerID: 'provider', id: 'model' } },
  ) => {
    emit({
      id: `${messageID}-start`,
      type: 'session.step.started',
      data: { sessionID, assistantMessageID: messageID, agent, model },
    })
    emit({
      id: `${messageID}-end`,
      type: 'session.step.ended',
      data: { sessionID, assistantMessageID: messageID, cost, tokens: tokens(1) },
    })
  }

  return {
    context,
    claims,
    layers,
    toasts,
    calls,
    setRoute,
    displayedSessionID,
    blockHistory,
    emit,
    settleStep,
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0
    },
    allListenerCount() {
      return allListeners.size
    },
  }
}

export async function waitForSnapshot(sessionData, predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  let snapshot = sessionData.getSnapshot()
  while (!predicate(snapshot) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    snapshot = sessionData.getSnapshot()
  }
  return snapshot
}
