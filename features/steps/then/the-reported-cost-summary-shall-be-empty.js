import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported cost summary shall be empty', function () {
  assert.equal(this.costSummary.sessionID, null)
  assert.deepEqual(this.costSummary.agents, [])
  assert.equal(this.costSummary.unattributed, null)
})
