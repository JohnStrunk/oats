import { When } from '@cucumber/cucumber'
import { pause, traversalHost } from '../refresh_coalescing_helper.js'

When('session data access is disposed during an abortable {string} host read', async function (blockedOperation) {
  const h = traversalHost({ abortable: true, blockedOperation })
  this.coalescingHosts.push(h)
  await h.start()
  h.service.dispose()
  await pause(50)
  this.pendingReadAborted = h.aborted
  h.release()
})
