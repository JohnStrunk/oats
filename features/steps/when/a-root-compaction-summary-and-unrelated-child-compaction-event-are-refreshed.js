import { When } from '@cucumber/cucumber'
import { tokens } from '../regression_session_helper.js'

When('a root compaction summary and unrelated child compaction event are refreshed', async function () {
  const h = this.retentionHost
  h.state.messages.root = [{ id: 'root-compact', type: 'compaction', status: 'completed', reason: 'auto', summary: 'summary', recent: '', time: { created: 100 }, cost: 2, tokens: tokens(2) }]
  // Durable usage events are read from the session log, not emitted live.
  h.state.logs.child = [{ id: 'child-compact-call', type: 'session.usage.recorded', created: 200, durable: { aggregateID: 'child', seq: 1, version: 1 }, data: { sessionID: 'child', source: 'compaction', cost: 7, tokens: tokens(7) } }]
  await h.service.refresh()
  this.retentionSnapshot = structuredClone(h.service.getSnapshot())
})
