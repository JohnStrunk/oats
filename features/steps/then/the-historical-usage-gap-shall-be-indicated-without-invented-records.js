import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the historical usage gap shall be indicated without invented records', function () {
  const snapshot = this.service.getSnapshot()
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'historical-usage-unavailable' && g.sessionID === 'root'), 'the historical gap must identify the affected session')
  assert.deepEqual(snapshot.records.map((r) => r.cost).sort(), [1, 2])
})
