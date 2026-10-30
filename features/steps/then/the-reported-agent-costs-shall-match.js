import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported agent costs shall match:', function (table) {
  assert.ok(Array.isArray(this.costSummary.agents))
  const actual = this.costSummary.agents.map(({ agent, knownCost }) => ({ agent, knownCost }))
  const expected = table.hashes().map(({ agent, knownCost }) => ({ agent, knownCost: Number(knownCost) }))
  actual.sort((a, b) => a.agent.localeCompare(b.agent))
  expected.sort((a, b) => a.agent.localeCompare(b.agent))
  assert.deepEqual(actual, expected)
})
