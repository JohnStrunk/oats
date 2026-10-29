import { When } from '@cucumber/cucumber'
When('the displayed route changes to home and session data is refreshed', async function () {
  await this.service.refresh()
  this.host.route = { type: 'home' }
  await this.service.refresh()
})
