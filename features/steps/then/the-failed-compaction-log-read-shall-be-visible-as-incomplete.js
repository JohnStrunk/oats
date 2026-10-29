import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the failed compaction log read shall be visible as incomplete', function () {
  const snapshot = this.failedCompactionSnapshot
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.errors.some((error) => error.operation === 'session.log' && error.sessionID === 'root'), 'the log failure must identify the affected session')
  assert.ok(snapshot.gaps.some((gap) => gap.sessionID === 'root' && gap.kind === 'historical-usage-unavailable'), 'the unavailable log must be reported as a gap')
})
