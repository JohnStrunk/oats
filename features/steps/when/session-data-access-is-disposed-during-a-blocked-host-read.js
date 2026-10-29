import { When } from '@cucumber/cucumber'
import { pause, traversalHost } from '../refresh_coalescing_helper.js'

When('session data access is disposed during a blocked {string} host read', async function (blockedOperation) {
  const h = traversalHost({ blockedOperation })
  this.coalescingHosts.push(h)
  await h.start()
  h.service.dispose()
  this.readsAtDispose = h.reads.length
  h.release()
  h.emit('session.created', { parentID: 'root' })
  await h.service.refresh()
  await pause(50)
  this.readsAfterDispose = h.reads.slice(this.readsAtDispose)
})
