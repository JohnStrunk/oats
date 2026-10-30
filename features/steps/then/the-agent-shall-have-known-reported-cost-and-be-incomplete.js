import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the agent {string} shall have known reported cost {int} and be incomplete', function (agent, cost) {
  const entry = this.costSummary.agents.find((item) => item.agent === agent)
  assert.ok(entry)
  assert.equal(entry.knownCost, cost)
  assert.equal(entry.incomplete, true)
})
