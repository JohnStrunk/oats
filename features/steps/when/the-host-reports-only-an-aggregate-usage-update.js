import { When } from '@cucumber/cucumber'
import { tokens } from '../regression_session_helper.js'
When('the host reports only an aggregate usage update', async function () {
  const h = this.regressionHost
  await h.service.refresh()
  h.emit({ id: 'aggregate', created: 1, type: 'session.usage.updated', data: { sessionID: 'root', cost: 17, tokens: tokens(17) } })
  // A host update may trigger asynchronous reads; allow them to complete.
  await new Promise((resolve) => setTimeout(resolve, 100))
})
