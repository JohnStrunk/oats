import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('no further traversal reads shall start after disposal', function () {
  assert.deepEqual(this.readsAfterDispose, [])
})
