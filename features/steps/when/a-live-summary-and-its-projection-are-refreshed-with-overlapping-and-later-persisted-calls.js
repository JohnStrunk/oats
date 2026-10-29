import { When } from '@cucumber/cucumber'
import { compactionEvents, projectStart, projectEnd } from '../auto_compaction_helper.js'
import { event, tokens } from '../regression_session_helper.js'

When('a live summary and its projection are refreshed with overlapping and later persisted calls', async function () {
  const h = this.regressionHost
  await h.service.refresh()
  const e = compactionEvents()
  projectStart(h, e.start)
  projectEnd(h, e.end)
  this.windowLiveSnapshot = structuredClone(h.service.getSnapshot())
  // The pinned host projection does not include time.completed. The log has
  // no framing events: one call overlaps the witnessed window, one follows it.
  const later = event('evt_later_distinct_025', 'session.usage.recorded', 25, { sessionID: 'root', source: 'compaction', cost: 7, tokens: tokens(7) })
  later.created = e.end.created + 10
  h.logs.root = [e.callOne, later]
  await h.service.refresh()
  this.windowRefreshSnapshot = structuredClone(h.service.getSnapshot())
})
