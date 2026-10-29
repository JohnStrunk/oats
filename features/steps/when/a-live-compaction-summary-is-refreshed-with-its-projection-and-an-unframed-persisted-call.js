import { When } from '@cucumber/cucumber'
import { compactionEvents, projectStart, projectEnd } from '../auto_compaction_helper.js'

When('a live compaction summary is refreshed with its projection and an unframed persisted call', async function () {
  const h = this.regressionHost
  await h.service.refresh()
  const e = compactionEvents()
  projectStart(h, e.start)
  projectEnd(h, e.end)
  this.liveCompactionSnapshot = structuredClone(h.service.getSnapshot())
  // Persisted usage only: start and end are unavailable in this log.
  h.logs.root = [e.callOne]
  await h.service.refresh()
  this.unframedCompactionSnapshot = structuredClone(h.service.getSnapshot())
})
