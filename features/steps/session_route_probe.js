// Run in a Node process with the browser Solid condition, so createEffect is
// reactive as it is in the real TUI rather than Solid's inert SSR build.
import { createRoot } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { hostFixture, waitForSnapshot } from './session_data_helper.js'
import assert from 'node:assert/strict'

const mode = process.argv[2]
const { state, context } = hostFixture(mode === 'settlement' ? 'startup race' : 'switch')
let release, entered
if (mode === 'race' || mode === 'race-home') {
  const started = new Promise((resolve) => { entered = resolve })
  const promise = new Promise((resolve) => { release = resolve })
  state.gate = { entered, promise }
  state.started = started
}
let setStore, rootDispose
const serviceFactory = await import('../../src/session-data-access.js')
const service = createRoot((dispose) => {
  rootDispose = dispose
  const [store, set] = createStore({ route: state.route })
  setStore = set
  context.ui.router.current = () => store.route
  return serviceFactory.createSessionDataAccess(context)
})
try {
  if (mode === 'settlement') {
    await state.entered
    const model = { providerID: 'provider', id: 'old' }
    const tokens = { input: 4, output: 5, reasoning: 0, cache: { read: 0, write: 0 } }
    state.emit({ id: 'race-start', created: 1, type: 'session.step.started', durable: { aggregateID: 'root', seq: 1, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'race', agent: 'alpha', model, started: 1 } })
    Object.assign(state.messages.root[0], { cost: 6, tokens, time: { created: 1, completed: 2 } })
    state.emit({ id: 'race-end', created: 2, type: 'session.step.ended', durable: { aggregateID: 'root', seq: 2, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'race', finish: 'stop', cost: 6, tokens } })
    state.release()
    await waitForSnapshot(service, (s) => s.records?.some((r) => r.messageID === 'race' && r.cost === 6))
    await new Promise((resolve) => setTimeout(resolve, 100))
    console.log(JSON.stringify(service.getSnapshot()))
  } else {
  if (mode === 'race' || mode === 'race-home') await state.started
  else {
    const initial = await waitForSnapshot(service, (s) => s.sessionID === 'root' && s.records?.some((r) => r.messageID === 'root-1'))
    assert.ok(initial.records.some((r) => r.messageID === 'root-1'), 'initial route must load automatically')
  }
  const home = mode === 'home' || mode === 'race-home'
  setStore('route', reconcile(home ? { type: 'home' } : { type: 'session', sessionID: 'new-root' }))
  const snapshot = await waitForSnapshot(service, (s) => home ? s.sessionID == null && s.records?.length === 0 : s.sessionID === 'new-root' && s.records?.some((r) => r.messageID === 'new-m'))
  if (mode === 'race' || mode === 'race-home') {
    assert.equal(snapshot.sessionID, home ? null : 'new-root', 'new route must take effect while previous history is blocked')
    release()
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  console.log(JSON.stringify(service.getSnapshot()))
  }
} finally { service.dispose?.(); rootDispose() }
