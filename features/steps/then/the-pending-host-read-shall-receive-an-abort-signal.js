import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the pending host read shall receive an abort signal', function () {
  assert.equal(this.pendingReadAborted, true)
})
