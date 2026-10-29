import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the known grandchild record shall remain with a stale metadata gap', function () {
  const prior = this.retentionHost.baseline.records.find((r) => r.sessionID === 'grandchild' && r.messageID === 'grand-1')
  assert.ok(prior, 'the successful initial read must establish the grandchild record')
  const snapshot = this.retentionSnapshot
  assert.deepEqual(snapshot.records.filter((r) => r.id === prior.id), [prior])
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'root'))
  assert.ok(snapshot.gaps.some((g) => g.kind === 'session-metadata-stale' && g.sessionID === 'grandchild'), 'the retained grandchild must have a stale metadata gap')
})
