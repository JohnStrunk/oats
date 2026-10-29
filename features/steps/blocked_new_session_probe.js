// The browser condition gives the route the same reactive Solid store semantics
// as the TUI. The fixture implements the external host, not the service.
import assert from 'node:assert/strict'
import { createRoot } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { hostFixture, waitForSnapshot } from './session_data_helper.js'
import { createSessionDataAccess } from '../../src/session-data-access.js'

const { state, context } = hostFixture('switch')
const originalList = context.client.message.list
let release
let entered
const blocked = new Promise((resolve) => { entered = resolve })
const gate = new Promise((resolve) => { release = resolve })
context.client.message.list = async (args) => {
  if (args.sessionID === 'new-root') {
    entered()
    await gate
  }
  return originalList(args)
}

let setStore, disposeRoot
const service = createRoot((dispose) => {
  disposeRoot = dispose
  const [store, set] = createStore({ route: state.route })
  setStore = set
  context.ui.router.current = () => store.route
  return createSessionDataAccess(context)
})
try {
  const initial = await waitForSnapshot(service, (snapshot) => snapshot.sessionID === 'root' && snapshot.records?.some((record) => record.messageID === 'root-1'))
  assert.equal(initial.sessionID, 'root', 'the first session must load before switching')
  assert.ok(initial.records.some((record) => record.messageID === 'root-1'))
  setStore('route', reconcile({ type: 'session', sessionID: 'new-root' }))
  await blocked
  const intermediate = structuredClone(service.getSnapshot())
  release()
  const final = await waitForSnapshot(service, (snapshot) => snapshot.sessionID === 'new-root' && snapshot.records?.some((record) => record.messageID === 'new-m'))
  console.log(JSON.stringify({ intermediate, final }))
} finally {
  release()
  service.dispose()
  disposeRoot()
}
