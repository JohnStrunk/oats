import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the agent {string} total shall be complete', function (agent) {
  const entry = this.costSummary.agents.find((item) => item.agent === agent)
  assert.ok(entry, `missing agent ${agent}`)
  assert.equal(entry.incomplete, false)
})
