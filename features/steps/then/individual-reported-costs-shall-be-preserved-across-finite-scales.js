import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'

Then('individual reported costs shall be preserved across finite scales', async function () {
  const verify = async (cost) => {
    const result = await this.aggregateGeneratedSnapshot({
      sessionID: 'root', complete: true, gaps: [], errors: [],
      records: [{ id: '1', sessionID: 'root', agent: 'alpha', model: null, cost }],
    })
    assert.equal(result.agents.length, 1)
    assert.equal(result.agents[0].agent, 'alpha')
    assert.equal(result.agents[0].knownCost, cost)
    assert.equal(result.agents[0].incomplete, false)
  }
  // Explicit endpoints ensure the run exercises subnormal and maximal values.
  for (const cost of [0, Number.MIN_VALUE, 1e-300, 1e-100, 1e100, 1e300, Number.MAX_VALUE]) await verify(cost)
  await fc.assert(fc.asyncProperty(
    fc.double({ min: 0, max: Number.MAX_VALUE, noNaN: true }), verify,
  ), { numRuns: 100 })
})
