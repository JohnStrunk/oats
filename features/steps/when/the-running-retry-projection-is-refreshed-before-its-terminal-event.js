import { When } from '@cucumber/cucumber'

When('the running retry projection is refreshed before its terminal event', async function () {
  this.beforeRunningRetryRefresh = structuredClone(this.regressionHost.service.getSnapshot())
  this.runningRetryProjection = structuredClone(this.regressionHost.messages.root.find((m) => m.id === 'retry-missing'))
  await this.regressionHost.service.refresh()
  this.runningRetrySnapshot = structuredClone(this.regressionHost.service.getSnapshot())
})
