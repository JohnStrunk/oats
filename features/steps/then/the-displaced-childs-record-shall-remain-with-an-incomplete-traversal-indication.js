import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then("the displaced child's record shall remain with an incomplete traversal indication", function () {
  const prior = this.retentionHost.baseline.records.find((r) => r.sessionID === 'child' && r.messageID === 'child-1')
  assert.ok(prior, 'the successful initial read must establish the child record')
  const snapshot = this.retentionSnapshot
  assert.deepEqual(snapshot.records.filter((r) => r.id === prior.id), [prior])
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.errors.some((e) => e.operation === 'session.traversal' && e.sessionID === 'root' && /limit/i.test(e.message)), 'the node cap must be reported')
})
