import { When } from '@cucumber/cucumber'

When('the initial session lookup fails and a later lookup succeeds', async function () {
  const host = this.lookupRegressionHost
  host.lookupFails = true
  host.route = { type: 'session', sessionID: 'root' }
  await host.service.refresh()
  this.initialLookupSnapshot = host.service.getSnapshot()
  host.lookupFails = false
  await host.service.refresh()
  this.recoveredLookupSnapshot = host.service.getSnapshot()
})
