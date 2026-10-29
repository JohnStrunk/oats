import { When } from '@cucumber/cucumber'
import fc from 'fast-check'
import { event, regressionHost, tokens, until } from '../regression_session_helper.js'
When('a later regression compaction has equal usage', async function () {
  this.compactionSnapshots = []
  for (const cost of fc.sample(fc.integer({ min: 0, max: 100000 }), { seed: 42, numRuns: 12 })) {
    const h = regressionHost()
    this.regressionHosts.push(h)
    h.messages.root = [{ type: 'compaction', status: 'completed', id: 'old-compaction', time: { created: 1 }, reason: 'auto', summary: 'old', recent: 'old', cost, tokens: tokens(cost) }]
    await h.service.refresh()
    // V2 publishes compaction terminals, not individual usage.recorded calls,
    // on the live bus. The later projection is a distinct host summary.
    h.emit(event('start-compaction', 'session.compaction.started', 99, { sessionID: 'root', reason: 'auto', inputID: 'new-compaction', recent: 'SECRET_RECENT_435' }))
    h.messages.root.push({ type: 'compaction', status: 'completed', id: 'new-compaction', time: { created: 99 }, reason: 'auto', summary: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost, tokens: tokens(cost) })
    const ended = event('new-compaction-end', 'session.compaction.ended', 100, { sessionID: 'root', reason: 'auto', text: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost, tokens: tokens(cost) })
    h.emit(ended)
    h.emit(ended)
    await until(() => h.service.getSnapshot().records.filter((r) => r.source === 'compaction').length >= 2)
    await h.service.refresh()
    this.compactionSnapshots.push({ cost, snapshot: h.service.getSnapshot() })
  }
})
