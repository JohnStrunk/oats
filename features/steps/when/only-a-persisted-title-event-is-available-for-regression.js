import { When } from '@cucumber/cucumber'
import { event, message, tokens } from '../regression_session_helper.js'
When('only a persisted title event is available for regression', async function () {
  const h = this.regressionHost
  h.messages.root = [message('existing', 4)]
  h.logs.root = [event('title', 'session.usage.recorded', 1, { sessionID: 'root', source: 'title', cost: 2, tokens: tokens(2) })]
  await h.service.refresh()
})
