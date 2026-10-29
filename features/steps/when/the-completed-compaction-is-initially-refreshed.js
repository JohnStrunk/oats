import { When } from '@cucumber/cucumber'

When('the completed compaction is initially refreshed', async function () {
  await this.followupHost.service.refresh()
  this.initialCompactionSnapshot = structuredClone(this.followupHost.service.getSnapshot())
})
