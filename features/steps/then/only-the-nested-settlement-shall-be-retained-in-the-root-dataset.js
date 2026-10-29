import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { usage } from '../settlement_boundary_helper.js'

Then('only the nested settlement shall be retained in the root dataset', function () {
  for (const snapshot of [this.rootBoundarySnapshot, this.regressionHost.service.getSnapshot()]) {
    assert.equal(snapshot.sessionID, 'root')
    assert.deepEqual(snapshot.records.map((r) => [r.sessionID, r.messageID]), [['grandchild', 'nested-live']])
    assert.equal(snapshot.records[0].cost, 5)
    assert.deepEqual(snapshot.records[0].tokens, usage(17))
  }
  assert.equal(this.unrelatedBoundarySnapshot.sessionID, 'unrelated')
  const unrelated = this.unrelatedBoundarySnapshot.records
  assert.deepEqual(unrelated.map((r) => [r.sessionID, r.messageID]), [['unrelated', 'outside-live']])
  assert.equal(unrelated[0].agent, 'outside-agent')
  assert.equal(unrelated[0].cost, 9)
  assert.deepEqual(unrelated[0].tokens, usage(23))
})
