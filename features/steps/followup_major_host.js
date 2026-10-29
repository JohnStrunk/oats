import { After } from '@cucumber/cucumber'
import { createSessionDataAccess } from '../../src/session-data-access.js'

export const tokens = (input, output = input) => ({ input, output, reasoning: 0, cache: { read: 0, write: 0 } })
export const model = (id) => ({ providerID: 'provider', id })
export const event = (sessionID, id, type, seq, created, data = {}) => ({
  id, type, created, durable: { aggregateID: sessionID, seq, version: 1 }, data: { sessionID, ...data },
})
export const session = (id, parentID) => ({ id, ...(parentID ? { parentID } : {}), projectID: 'project', time: { created: 1, updated: 1 }, location: { directory: '/workspace' } })
export const summary = (id, created, cost, usage) => ({ id, type: 'compaction', status: 'completed', reason: 'auto', summary: 'summary', recent: '', time: { created }, cost, tokens: usage })

// Only host client and event boundaries are faked; snapshots are from OATS.
export function followupHost() {
  const h = { sessions: [session('root')], messages: { root: [] }, logs: {}, listeners: new Map(), gate: null }
  h.context = {
    ui: { router: { current: () => ({ type: 'session', sessionID: 'root' }) } },
    data: {
      on(type, cb) { if (!h.listeners.has(type)) h.listeners.set(type, new Set()); h.listeners.get(type).add(cb); return () => h.listeners.get(type).delete(cb) },
      listen() { return () => {} },
    },
    client: {
      session: {
        async get({ sessionID }) { return h.sessions.find((s) => s.id === sessionID) },
        async list({ parentID }) { return { data: structuredClone(h.sessions.filter((s) => s.parentID === parentID)), cursor: {} } },
        async *log({ sessionID }) { yield* structuredClone(h.logs[sessionID] ?? []); yield { type: 'log.synced', aggregateID: sessionID } },
      },
      message: {
        async list({ sessionID }) {
          const data = structuredClone(h.messages[sessionID] ?? [])
          if (h.gate && sessionID === 'root') {
            const gate = h.gate; h.gate = null; gate.entered(); await gate.promise
          }
          return { data, cursor: {} }
        },
      },
    },
  }
  h.block = () => {
    let entered, release
    const started = new Promise((resolve) => { entered = resolve })
    const promise = new Promise((resolve) => { release = resolve })
    h.gate = { entered, promise }; h.release = release
    return started
  }
  h.emit = (e) => { for (const callback of h.listeners.get(e.type) ?? []) callback(e) }
  h.service = createSessionDataAccess(h.context)
  return h
}
After(function () { this.followupHost?.release?.(); this.followupHost?.service.dispose() })
