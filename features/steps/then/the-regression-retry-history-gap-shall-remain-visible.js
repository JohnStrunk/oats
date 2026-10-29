import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the regression retry history gap shall remain visible', function () {
  const snapshot = this.regressionHost.service.getSnapshot()
  assert.ok(snapshot.records.some((r) => r.source === 'title' && r.cost === 2))
  assert.ok(snapshot.records.some((r) => r.messageID === 'existing' && r.cost === 4))
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps.some((g) => g.sessionID === 'root' && /historical|retry/i.test(g.kind)), 'partial event log does not prove retry history complete')
})
