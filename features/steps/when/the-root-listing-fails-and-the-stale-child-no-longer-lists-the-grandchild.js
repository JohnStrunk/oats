import { When } from '@cucumber/cucumber'

When('the root listing fails and the stale child no longer lists the grandchild', async function () {
  const h = this.retentionHost
  h.state.failures.add('session:root:0')
  h.state.sessions.find((s) => s.id === 'grandchild').parentID = 'outside'
  await h.service.refresh()
  this.retentionSnapshot = structuredClone(h.service.getSnapshot())
})
