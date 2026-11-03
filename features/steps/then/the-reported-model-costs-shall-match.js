import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the reported model costs shall match:', function (table) {
  const summary = this.modelCostSummary
  assert.ok(summary, 'a model cost summary must have been requested at the component boundary')
  assert.ok(Array.isArray(summary.models), 'the summary must expose model rows')

  const actual = summary.models.map(({ model, knownCost, incomplete, roundedCost }) => ({
    model,
    knownCost,
    incomplete,
    roundedCost,
  }))
  if (summary.unattributed !== null && summary.unattributed !== undefined) {
    const { knownCost, incomplete, roundedCost } = summary.unattributed
    actual.push({ model: 'Unattributed', knownCost, incomplete, roundedCost })
  }

  const expected = table.hashes().map(({ model, knownCost, incomplete, roundedCost }) => ({
    model,
    knownCost: knownCost === 'null' ? null : Number(knownCost),
    incomplete: incomplete === 'true',
    roundedCost: roundedCost === 'null' ? null : roundedCost,
  }))
  actual.sort((left, right) => left.model < right.model ? -1 : left.model > right.model ? 1 : 0)
  expected.sort((left, right) => left.model < right.model ? -1 : left.model > right.model ? 1 : 0)
  assert.deepEqual(actual, expected)
})
