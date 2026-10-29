import { When } from '@cucumber/cucumber'
import { finish, start } from '../regression_session_helper.js'
When('a regression retry starts after an identified failure', async function () {
  const h = this.regressionHost
  await h.service.refresh()
  start(h, 'root', 'retry', 1, 'first-agent', 'first-model')
  finish(h, 'root', 'retry', 2, 3, true)
  start(h, 'root', 'retry', 3, 'retry-agent', 'retry-model')
  finish(h, 'root', 'retry', 4, 7)
  await h.service.refresh()
})
