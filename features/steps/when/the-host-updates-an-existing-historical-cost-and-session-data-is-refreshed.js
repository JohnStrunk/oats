import { When } from '@cucumber/cucumber'

When('the host updates an existing historical cost and session data is refreshed', async function () {
  this.host.messages.root.find((message) => message.id === 'root-1').cost = 7
  await this.service.refresh()
})
