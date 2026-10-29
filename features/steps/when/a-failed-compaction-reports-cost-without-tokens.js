import { When } from '@cucumber/cucumber'
import { event } from '../regression_session_helper.js'
When('a failed compaction reports cost without tokens', async function () {
  const h = this.regressionHost
  await h.service.refresh()
  h.emit(event('failed-start', 'session.compaction.started', 1, { sessionID: 'root', reason: 'auto', inputID: 'failed-compaction', recent: 'SECRET_RECENT_435' }))
  const error = { type: 'provider', message: 'SECRET_ERROR_435' }
  h.messages.root.push({ type: 'compaction', status: 'failed', id: 'failed-compaction', time: { created: 1 }, reason: 'auto', error, cost: 4 })
  const failed = event('failed-end', 'session.compaction.failed', 2, { sessionID: 'root', reason: 'auto', inputID: 'failed-compaction', error, cost: 4 })
  h.emit(failed)
  h.emit(failed)
})
