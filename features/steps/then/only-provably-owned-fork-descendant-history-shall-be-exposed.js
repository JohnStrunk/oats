import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('only provably owned fork descendant history shall be exposed', function () {
  const snapshot = this.service.getSnapshot()
  assert.deepEqual(snapshot.records.map((r) => [r.sessionID, r.messageID, r.cost]), [['fork-child', 'child-own', 4]])
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'fork-provenance-uncertain' && g.sessionID === 'root'))
})
