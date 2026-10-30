import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the agent {string} shall have no known reported cost and be incomplete', function (agent) {
  const entry = this.costSummary.agents.find((item) => item.agent === agent)
  assert.ok(entry)
  assert.equal(entry.knownCost, null)
  assert.equal(entry.incomplete, true)
})
