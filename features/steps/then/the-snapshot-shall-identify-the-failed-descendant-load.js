import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the snapshot shall identify the failed descendant load', function () {
  const snapshot = this.service.getSnapshot()
  assert.equal(snapshot.sessionID, 'root')
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.errors.some((error) => error.sessionID === 'child' && typeof error.operation === 'string' && error.operation.length > 0))
})
