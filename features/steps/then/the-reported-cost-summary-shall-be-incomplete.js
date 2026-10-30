import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported cost summary shall be incomplete', function () {
  assert.equal(this.costSummary.incomplete, true)
})
