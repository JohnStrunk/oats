import { After } from '@cucumber/cucumber'
import { createSessionDataAccess } from '../../src/session-data-access.js'

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export async function waitFor(predicate, message, timeout = 1000) {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message)
    await pause(5)
  }
}
export { pause }

const session = (id, parentID) => ({ id, ...(parentID ? { parentID } : {}), projectID: 'project', time: { created: 1, updated: 1 }, location: { directory: '/workspace' } })
const message = (id) => ({ id, type: 'assistant', agent: 'agent', model: { providerID: 'provider', id: 'model' }, content: [], time: { created: 1, completed: 2 }, cost: 1, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } })

// Controlled third-party boundary: the first root child listing captures a
// pre-change page and can be parked independently of subsequent host calls.
export function traversalHost({ abortable = false, blockedOperation = 'list' } = {}) {
  const host = { route: { type: 'home' }, reads: [], sessions: [session('root'), session('other')], listeners: new Set(), aborted: false }
  let release
  host.gate = new Promise((resolve) => { release = resolve })
  host.release = release
  let block = true
  const read = (method, id) => host.reads.push({ method, id })
  const park = async (operation, id, options) => {
    if (id !== 'root' || operation !== blockedOperation || !block) return
    block = false
    host.blocked = true
    if (abortable && options?.signal) {
      const signal = options.signal
      await new Promise((resolve, reject) => {
        const abort = () => { host.aborted = true; reject(new Error('host read aborted')) }
        if (signal.aborted) return abort()
        signal.addEventListener('abort', abort, { once: true })
        host.gate.then(() => { signal.removeEventListener('abort', abort); resolve() })
      })
    } else {
      // Non-abortable read may finish concurrently with disposal.
      await host.gate
    }
  }
  const context = {
    ui: { router: { current: () => host.route } },
    data: { on: () => () => {}, listen(callback) { host.listeners.add(callback); return () => host.listeners.delete(callback) } },
    client: {
      session: {
        async get({ sessionID }, options) { read('get', sessionID); await park('get', sessionID, options); return host.sessions.find((s) => s.id === sessionID) },
        async list({ parentID }, options) {
          read('list', parentID)
          const rows = structuredClone(host.sessions.filter((s) => s.parentID === parentID))
          await park('list', parentID, options)
          return { data: rows, cursor: {} }
        },
        async *log({ sessionID }, options) { read('log', sessionID); await park('log', sessionID, options); yield { type: 'log.synced', aggregateID: sessionID } },
      },
      message: { async list({ sessionID }, options) { read('messages', sessionID); await park('messages', sessionID, options); return { data: [message(`msg-${sessionID}`)], cursor: {} } } },
    },
  }
  host.emit = (type, data) => { for (const cb of host.listeners) cb({ details: { type, data } }) }
  host.addChild = () => host.sessions.push(session('child', 'root'))
  host.service = createSessionDataAccess(context)
  host.start = async () => {
    host.route = { type: 'session', sessionID: 'root' }
    void host.service.refresh()
    await waitFor(() => host.blocked, 'Initial root listing did not start')
  }
  return host
}

After(function () {
  for (const host of this.coalescingHosts ?? []) {
    host.service.dispose()
    host.release()
  }
})
