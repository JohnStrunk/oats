import { When } from '@cucumber/cucumber'

When('confirmed history and live usage are followed by a failed session lookup', async function () {
  const host = this.lookupRegressionHost
  host.route = { type: 'session', sessionID: 'root' }
  await host.service.refresh()
  host.emit({ id: 'regression-start', type: 'session.step.started', created: 10, data: { sessionID: 'root', assistantMessageID: 'live-regression', agent: 'live-agent', model: { providerID: 'provider', id: 'live-model' }, started: 10 } })
  host.emit({ id: 'regression-end', type: 'session.step.ended', created: 11, data: { sessionID: 'root', assistantMessageID: 'live-regression', finish: 'stop', cost: 7, tokens: { input: 5, output: 6, reasoning: 0, cache: { read: 0, write: 0 } } } })
  this.confirmedLookupSnapshot = structuredClone(host.service.getSnapshot())
  host.lookupFails = true
  await host.service.refresh()
  this.failedLookupSnapshot = host.service.getSnapshot()
})
