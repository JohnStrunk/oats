import { When } from '@cucumber/cucumber'

When('the fork is refreshed before and after session lookup recovery', async function () {
  const host = this.forkLookupHost
  host.route = { type: 'session', sessionID: 'fork' }
  await host.service.refresh()
  this.uncertainForkSnapshot = host.service.getSnapshot()
  host.mode = 'available'
  await host.service.refresh()
  this.recoveredForkSnapshot = host.service.getSnapshot()
})
