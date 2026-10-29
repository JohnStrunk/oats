import { When } from '@cucumber/cucumber'
When('a descendant history fails and then succeeds on refresh', async function () {
  this.host.failures.add('message:child:0')
  await this.service.refresh()
  this.host.failures.clear()
  await this.service.refresh()
})
