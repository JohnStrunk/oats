import { When } from '@cucumber/cucumber'
import { event, tokens } from '../followup_major_host.js'

When('a later unframed compaction call is recorded in the same session', async function () {
  // The durable session sequence puts this call after the earlier end event;
  // no new compaction start or summary is available in this partial log.
  this.followupHost.logs.root.push(event('root', 'evt_later_unframed_call_025', 'session.usage.recorded', 25, 1700000000250, { source: 'compaction', cost: 7, tokens: tokens(7) }))
  await this.followupHost.service.refresh()
  this.laterCompactionSnapshot = structuredClone(this.followupHost.service.getSnapshot())
})
