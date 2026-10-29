import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('no individual title cost shall be invented', function () {
  const snapshot = this.regressionHost.service.getSnapshot()
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'historical-usage-unavailable' && g.sessionID === 'root'))
  assert.deepEqual(snapshot.records, [], 'an aggregate is not a per-call title or usage record')
})
