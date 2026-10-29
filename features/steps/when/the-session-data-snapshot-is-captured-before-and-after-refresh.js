import { When } from '@cucumber/cucumber'

When('the session data snapshot is captured before and after refresh', async function () {
  await this.service.refresh()
  this.snapshotBeforeRefresh = structuredClone(this.service.getSnapshot())
  await this.service.refresh()
})
