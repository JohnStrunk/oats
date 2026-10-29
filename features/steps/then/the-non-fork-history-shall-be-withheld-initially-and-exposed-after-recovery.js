import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the non-fork history shall be withheld initially and exposed after recovery', function () {
  const initial = this.initialLookupSnapshot
  const recovered = this.recoveredLookupSnapshot
  assert.equal(initial.sessionID, 'root')
  assert.deepEqual(initial.records, [], 'unproven historical usage must be withheld')
  assert.equal(initial.complete, false)
  assert.ok(initial.errors.some((e) => e.sessionID === 'root' && e.operation === 'session.get'), 'initial lookup failure must be identified')
  assert.equal(recovered.sessionID, 'root')
  assert.deepEqual(recovered.records.map((r) => [r.messageID, r.agent, r.model?.id, r.cost]).sort(), [
    ['root-1', 'alpha', 'old', 1],
    ['root-2', 'beta', 'new', 2],
  ])
  assert.ok(!recovered.errors.some((e) => e.sessionID === 'root' && e.operation === 'session.get'), 'recovery clears the lookup error')
  assert.ok(this.lookupRegressionHost.lookupCalls.some((call) => call.sessionID === 'root' && call.failed))
  assert.ok(this.lookupRegressionHost.lookupCalls.some((call) => call.sessionID === 'root' && !call.failed))
})
