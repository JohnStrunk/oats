import { createSessionDataAccess } from '../../src/session-data-access.js'

// OpenCode 2.0.32 event envelopes use wall-clock milliseconds independently
// of the per-session durable sequence number.
export function stepEvent(type, sessionID, messageID, seq, created, fields) {
  return {
    id: `${sessionID}-${messageID}-${type}-${seq}`,
    type,
    created,
    durable: { aggregateID: sessionID, seq, version: 1 },
    data: { sessionID, assistantMessageID: messageID, ...fields },
  }
}

export const model = (id) => ({ providerID: 'provider', id })
export const usage = (n) => ({ input: n, output: n + 1, reasoning: 0, cache: { read: 0, write: 0 } })

// Match the v2.0.32 assistant-message projection at the host boundary: a
// retry replaces identity and completion, but does not clear old usage.
function projectedMessage(host, sessionID, messageID) {
  return (host.messages[sessionID] ?? []).find((m) => m.id === messageID && m.type === 'assistant')
}

export function emitStart(host, sessionID, messageID, seq, time, agent, modelID) {
  const message = projectedMessage(host, sessionID, messageID)
  if (message) {
    Object.assign(message, { agent, model: model(modelID) })
    for (const key of ['retry', 'error', 'finish', 'rawFinish', 'providerState']) delete message[key]
    message.time.created = time
    delete message.time.streamed
    delete message.time.completed
  } else {
    host.messages[sessionID] ??= []
    host.messages[sessionID].push({ id: messageID, type: 'assistant', agent, model: model(modelID), content: [], time: { created: time } })
  }
  host.emit(stepEvent('session.step.started', sessionID, messageID, seq, time, {
    agent, model: model(modelID), started: time,
  }))
}

export function projectEnd(host, sessionID, messageID, time, cost, tokens) {
  const message = projectedMessage(host, sessionID, messageID)
  if (message) Object.assign(message, { time: { ...message.time, completed: time }, finish: 'stop', cost, tokens })
}

export function emitEnd(host, sessionID, messageID, seq, time, cost, tokens) {
  projectEnd(host, sessionID, messageID, time, cost, tokens)
  host.emit(stepEvent('session.step.ended', sessionID, messageID, seq, time, {
    finish: 'stop', cost, tokens,
  }))
}

export function emitFailure(host, sessionID, messageID, seq, time, error) {
  const message = projectedMessage(host, sessionID, messageID)
  if (message) {
    message.time.completed = time
    message.finish = 'error'
    message.error = error
    delete message.retry
    // The host leaves previous cost and tokens unchanged when both are absent.
  }
  host.emit(stepEvent('session.step.failed', sessionID, messageID, seq, time, { error }))
}

// This isolated host can delay a captured message-list response while the
// underlying host projection continues to change. It models a stale read,
// not a host that discards updates when an event arrives.
export function staleReadHost() {
  const host = { route: { type: 'session', sessionID: 'root' }, sessions: [], messages: {}, listeners: new Map(), all: new Set(), gate: null }
  const context = {
    ui: { router: { current: () => host.route } },
    data: {
      on(type, cb) {
        if (!host.listeners.has(type)) host.listeners.set(type, new Set())
        host.listeners.get(type).add(cb)
        return () => host.listeners.get(type).delete(cb)
      },
      listen(cb) { host.all.add(cb); return () => host.all.delete(cb) },
    },
    client: {
      session: {
        async get({ sessionID }) { return host.sessions.find((s) => s.id === sessionID) },
        async list({ parentID }) { return { data: structuredClone(host.sessions.filter((s) => s.parentID === parentID)), cursor: {} } },
        async *log({ sessionID }) { yield { type: 'log.synced', aggregateID: sessionID } },
      },
      message: {
        async list({ sessionID, type }) {
          const data = structuredClone((host.messages[sessionID] ?? []).filter((m) => !type || m.type === type))
          if (host.gate?.sessionID === sessionID) {
            const gate = host.gate
            host.gate = null
            gate.entered()
            await gate.promise
          }
          return { data, cursor: {} }
        },
      },
    },
  }
  host.emit = (event) => {
    for (const callback of host.listeners.get(event.type) ?? []) callback(event)
    for (const callback of host.all) callback({ details: event })
  }
  host.blockMessageRead = (sessionID) => {
    let entered, release
    const started = new Promise((resolve) => { entered = resolve })
    const promise = new Promise((resolve) => { release = resolve })
    host.gate = { sessionID, entered, promise }
    return { started, release }
  }
  host.service = createSessionDataAccess(context)
  return host
}
