import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported model cost summary shall be incomplete', function () {
  assert.equal(this.modelCostSummary?.incomplete, true)
})
