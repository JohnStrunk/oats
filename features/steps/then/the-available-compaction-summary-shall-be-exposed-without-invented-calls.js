import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the available compaction summary shall be exposed without invented calls', function () {
  const snapshot = this.service.getSnapshot()
  assert.equal(snapshot.complete, false)
  assert.equal(snapshot.records.length, 1)
  assert.equal(snapshot.records[0].cost, 3)
  assert.equal(snapshot.records[0].sessionID, 'root')
  assert.ok(snapshot.records[0].agent == null)
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_'))
})
