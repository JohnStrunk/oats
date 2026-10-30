import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the unattributed reported cost shall be {int}', function (cost) {
  assert.equal(this.costSummary.unattributed?.knownCost, cost)
})
