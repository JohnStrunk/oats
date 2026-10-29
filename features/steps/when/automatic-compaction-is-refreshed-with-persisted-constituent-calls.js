import { When } from '@cucumber/cucumber'
import { compactionEvents, OTHER_MESSAGE_ID, projectEnd, projectStart, totalTokens } from '../auto_compaction_helper.js'

When('automatic compaction is refreshed with {string} persisted constituent calls', async function (mode) {
  if (!['no', 'complete', 'partial'].includes(mode)) throw new Error(`Unknown log mode ${mode}`)
  const h = this.regressionHost
  if (mode === 'complete') {
    // A separate compaction with the same reported usage is not the matching
    // summary, and must not be suppressed by another compaction's log.
    h.messages.root.push({ id: OTHER_MESSAGE_ID, type: 'compaction', status: 'completed', reason: 'auto', time: { created: 1699999999000 }, summary: 'previous', recent: '', cost: 2, tokens: totalTokens })
  }
  await h.service.refresh()
  const e = compactionEvents()
  projectStart(h, e.start)
  projectEnd(h, e.end)
  this.autoCompactionBeforeRefresh = h.service.getSnapshot()
  // session.usage.recorded is a persisted log entry, not a live TUI event.
  h.logs.root = mode === 'complete' ? [e.start, e.callOne, e.callTwo, e.end]
    : mode === 'partial' ? [e.start, e.callOne, e.end] : []
  await h.service.refresh()
})
