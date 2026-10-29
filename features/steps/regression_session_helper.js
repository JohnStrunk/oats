import { After } from '@cucumber/cucumber'
import { createSessionDataAccess } from '../../src/session-data-access.js'

export const tokens = (n) => ({ input: n, output: n + 1, reasoning: 0, cache: { read: 0, write: 0 } })
export const model = (id) => ({ providerID: 'provider', id })
export const session = (id, parentID) => ({ id, ...(parentID ? { parentID } : {}), projectID: 'project', time: { created: 1, updated: 1 }, location: { directory: '/workspace' } })
export const message = (id, cost, agent = 'old-agent', modelID = 'old-model') => ({ id, type: 'assistant', agent, model: model(modelID), content: [], time: { created: 1, completed: 2 }, cost, tokens: tokens(cost) })
export const event = (id, type, seq, data) => ({ id, created: seq, type, durable: { aggregateID: data.sessionID, seq, version: 1 }, data })

// The fake implements the v2 promise client and notification interfaces only.
export function regressionHost() {
  const host = { route: { type: 'session', sessionID: 'root' }, sessions: [session('root')], messages: { root: [] }, logs: {}, listeners: new Map(), all: new Set(), gate: null }
  const context = {
    ui: { router: { current: () => host.route } },
    data: {
      on(type, callback) {
        if (!host.listeners.has(type)) host.listeners.set(type, new Set())
        host.listeners.get(type).add(callback)
        return () => host.listeners.get(type).delete(callback)
      },
      listen(callback) { host.all.add(callback); return () => host.all.delete(callback) },
    },
    client: {
      session: {
        async get({ sessionID }) { return host.sessions.find((s) => s.id === sessionID) },
        async list({ parentID }) {
          const rows = structuredClone(host.sessions.filter((s) => s.parentID === parentID))
          if (host.gate?.parentID === parentID) {
            const gate = host.gate
            host.gate = null
            gate.entered()
            await gate.promise
          }
          return { data: rows, cursor: {} }
        },
        async *log({ sessionID }) {
          yield* structuredClone(host.logs[sessionID] ?? [])
          yield { type: 'log.synced', aggregateID: sessionID }
        },
      },
      message: {
        async list({ sessionID, type }) {
          return { data: structuredClone((host.messages[sessionID] ?? []).filter((m) => !type || m.type === type)), cursor: {} }
        },
      },
    },
  }
  host.emit = (e) => {
    if (e.type === 'session.usage.recorded') throw new Error('session.usage.recorded is not an OpenCode V2 live event')
    for (const callback of host.listeners.get(e.type) ?? []) callback(e)
    for (const callback of host.all) callback({ details: e })
  }
  host.blockChildren = (parentID) => {
    let entered, release
    const started = new Promise((resolve) => { entered = resolve })
    const promise = new Promise((resolve) => { release = resolve })
    host.gate = { parentID, entered, promise }
    return { started, release }
  }
  host.service = createSessionDataAccess(context)
  return host
}

export function start(host, sessionID, messageID, seq, agent, modelID) {
  host.emit(event(`start-${sessionID}-${seq}`, 'session.step.started', seq, { sessionID, assistantMessageID: messageID, agent, model: model(modelID), started: seq }))
}
export function finish(host, sessionID, messageID, seq, cost, failed = false) {
  host.emit(event(`finish-${sessionID}-${seq}`, failed ? 'session.step.failed' : 'session.step.ended', seq, { sessionID, assistantMessageID: messageID, ...(failed ? { error: { type: 'provider', message: 'failed' } } : { finish: 'stop' }), cost, tokens: tokens(cost) }))
}
export async function until(predicate) {
  const deadline = Date.now() + 2000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for host load')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
After(function () { for (const host of this.regressionHosts ?? []) host.service.dispose() })
