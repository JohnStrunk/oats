import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { usage } from '../settlement_boundary_helper.js'

Then('the matching historical and live settlement shall be represented once', function () {
  for (const snapshot of [this.beforeBoundaryRefresh, this.regressionHost.service.getSnapshot()]) {
    const records = snapshot.records.filter((r) => r.sessionID === 'root' && r.messageID === 'same-attempt')
    assert.equal(records.length, 1, 'history and live event must not double-count one attempt')
    assert.equal(records[0].cost, 3)
    assert.deepEqual(records[0].tokens, usage(11))
  }
})
