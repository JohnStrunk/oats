import { When } from '@cucumber/cucumber'
import { traversalHost, waitFor, pause } from '../refresh_coalescing_helper.js'

When('the route changes while the old session traversal is blocked', async function () {
  const h = traversalHost()
  this.coalescingHosts.push(h)
  await h.start()
  h.route = { type: 'session', sessionID: 'other' }
  h.emit('session.viewed', { sessionID: 'other' })
  await waitFor(() => h.service.getSnapshot().sessionID === 'other', 'New route was blocked by the old host read')
  this.beforeRelease = h.service.getSnapshot()
  h.release()
  await pause(50)
  this.afterRelease = h.service.getSnapshot()
})
