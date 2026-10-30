import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported cost summary shall identify session {string}', function (sessionID) {
  assert.equal(this.costSummary.sessionID, sessionID)
})
