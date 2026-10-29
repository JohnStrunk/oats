import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('title and compaction call records shall be present once each', function () {
  const records = this.service.getSnapshot().records
  assert.equal(records.length, 2, 'the compaction summary must not be counted as a third call')
  assert.deepEqual(records.map((r) => [r.source, r.cost]).sort(), [['compaction', 3], ['title', 2]])
  assert.ok(records.every((r) => r.sessionID === 'root' && r.agent == null && r.model == null))
  assert.equal(new Set(records.map((r) => r.id)).size, 2)
  assert.ok(!JSON.stringify(records).includes('SECRET_'))
})
