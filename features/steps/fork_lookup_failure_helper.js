import { After } from '@cucumber/cucumber'
import { createSessionDataAccess } from '../../src/session-data-access.js'

const tokens = { input: 10, output: 2, reasoning: 0, cache: { read: 0, write: 0 } }
const session = (id, extra = {}) => ({ id, projectID: 'project', cost: 0, tokens, time: { created: 1, updated: 2 }, location: { directory: '/workspace' }, ...extra })
const message = (id, cost) => ({ id, type: 'assistant', agent: 'worker', model: { providerID: 'provider', id: 'model' }, time: { created: 1, completed: 2 }, content: [], cost, tokens })

// Only host interfaces are faked; refresh and snapshots use the real service.
export function forkLookupFailureHost(mode) {
  const state = { route: { type: 'home' }, mode, calls: [] }
  const root = session('fork', { fork: { sessionID: 'source', boundary: { type: 'through', messageID: 'source-message' } } })
  const child = session('child', { parentID: 'fork' })
  const messages = {
    source: [message('source-message', 11)],
    // The host copies historical messages under new IDs at fork time.
    fork: [message('copied-new-id', 11), message('ambiguous-fork-history', 13)],
    child: [message('child-own', 3)],
  }
  const context = {
    ui: { router: { current: () => state.route } },
    data: { on: () => () => {}, listen: () => () => {} },
    client: {
      session: {
        async get({ sessionID }) {
          state.calls.push(['get', sessionID, state.mode])
          if (sessionID === 'fork' && state.mode === 'fails') throw new Error('session lookup unavailable')
          if (sessionID === 'fork' && state.mode === 'is absent') return undefined
          return sessionID === 'fork' ? structuredClone(root) : undefined
        },
        async list({ parentID }) {
          return { data: parentID === 'fork' ? [structuredClone(child)] : [], cursor: {} }
        },
        async *log({ sessionID }) {
          if (sessionID === 'fork') yield { id: 'historical-title', created: 1, type: 'session.usage.recorded', durable: { aggregateID: 'fork', seq: 1, version: 1 }, data: { sessionID: 'fork', source: 'title', cost: 17, tokens } }
          yield { type: 'log.synced', aggregateID: sessionID }
        },
      },
      message: {
        async list({ sessionID }) {
          state.calls.push(['message.list', sessionID])
          return { data: structuredClone(messages[sessionID] ?? []), cursor: {} }
        },
      },
    },
  }
  state.service = createSessionDataAccess(context)
  return state
}

After(function () { this.forkLookupHost?.service.dispose() })
