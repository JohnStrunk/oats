import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the recovered fork snapshot shall contain only proven descendant history', function () {
  const snapshot = this.recoveredForkSnapshot
  assert.equal(snapshot.sessionID, 'fork')
  assert.deepEqual(snapshot.records.map((record) => [record.sessionID, record.messageID, record.cost]), [['child', 'child-own', 3]])
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps.some((gap) => gap.sessionID === 'fork' && gap.kind === 'fork-provenance-uncertain'))
  assert.ok(!snapshot.errors.some((error) => error.sessionID === 'fork' && error.operation === 'session.get'), 'a successful lookup clears its previous error')
  assert.ok(this.forkLookupHost.calls.some(([operation, sessionID, mode]) => operation === 'get' && sessionID === 'fork' && mode === 'available'))
})
