import { When } from '@cucumber/cucumber'
When('a descendant history fails during refresh', async function () {
  await this.service.refresh()
  this.host.failures.add('message:child:0')
  await this.service.refresh()
})
