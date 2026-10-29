import { Given } from '@cucumber/cucumber'
import { compactionEvents, MESSAGE_ID, totalTokens } from '../auto_compaction_helper.js'

Given('a persisted multi-call compaction and its completed summary', function () {
  const h = this.followupHost
  const e = compactionEvents()
  h.logs.root = [e.start, e.callOne, e.callTwo, e.end]
  h.messages.root = [{ id: MESSAGE_ID, type: 'compaction', status: 'completed', reason: 'auto', time: { created: e.start.created }, summary: 'summary', recent: 'recent context', cost: 2, tokens: totalTokens }]
})
