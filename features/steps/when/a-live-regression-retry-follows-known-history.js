import { When } from '@cucumber/cucumber'
import { finish, message, start } from '../regression_session_helper.js'
When('a live regression retry follows known history', async function () {
  const h = this.regressionHost
  h.messages.root = [message('retry', 3)]
  await h.service.refresh()
  start(h, 'root', 'retry', 3, 'retry-agent', 'retry-model')
  finish(h, 'root', 'retry', 4, 7)
  this.beforeRegressionRefresh = h.service.getSnapshot()
  await h.service.refresh()
})
