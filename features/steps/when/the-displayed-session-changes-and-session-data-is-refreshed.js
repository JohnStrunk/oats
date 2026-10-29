import { When } from '@cucumber/cucumber'
When('the displayed session changes and session data is refreshed', async function () {
  await this.service.refresh()
  this.host.route = { type: 'session', sessionID: 'new-root' }
  await this.service.refresh()
})
