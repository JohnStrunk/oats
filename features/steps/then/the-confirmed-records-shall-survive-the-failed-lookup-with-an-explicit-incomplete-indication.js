import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the confirmed records shall survive the failed lookup with an explicit incomplete indication', function () {
  const before = this.confirmedLookupSnapshot
  const after = this.failedLookupSnapshot
  const sorted = (records) => [...records].sort((a, b) => a.id.localeCompare(b.id))
  assert.equal(before.sessionID, 'root')
  assert.deepEqual(before.records.map((r) => [r.messageID, r.cost]).sort(), [['live-regression', 7], ['root-1', 1], ['root-2', 2]])
  assert.equal(after.sessionID, 'root')
  assert.deepEqual(sorted(after.records), sorted(before.records), 'previously confirmed historical and live records must retain their values and identities')
  assert.equal(after.complete, false)
  assert.ok(after.errors.some((e) => e.sessionID === 'root' && e.operation === 'session.get'), 'the failed lookup itself must be identified')
  assert.ok(this.lookupRegressionHost.lookupCalls.some((call) => call.sessionID === 'root' && call.failed))
})
