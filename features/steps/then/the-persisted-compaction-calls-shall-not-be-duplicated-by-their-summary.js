import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the persisted compaction calls shall not be duplicated by their summary', function () {
  const snapshot = this.service.getSnapshot()
  const records = snapshot.records.filter((r) => r.source === 'compaction')
  assert.deepEqual(records.map((r) => r.cost).sort((a, b) => a - b), [1, 2], 'the summary is not a third provider call')
  assert.equal(new Set(records.map((r) => r.id)).size, 2)
  assert.ok(records.every((r) => r.sessionID === 'root' && r.agent == null && r.model == null))
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_'))
})
