import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'

Then('reported totals shall be invariant under record order and model changes', async function () {
  const arbitraryRecord = fc.record({
    agent: fc.constantFrom('alpha', 'beta', 'gamma'),
    // Binary-exact fractions avoid imposing a rounding policy the issue has
    // not specified, while exercising both zero and fractional costs.
    cost: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 4_000_000 }).map((quarters) => quarters / 4)),
    model: fc.constantFrom(null, 'first', 'second', 'third'),
  })
  await fc.assert(fc.asyncProperty(fc.array(arbitraryRecord, { maxLength: 40 }), async (items) => {
    const records = items.map((item, i) => ({
      id: `record-${i}`, sessionID: i % 2 ? 'child' : 'root', agent: item.agent,
      cost: item.cost, model: item.model === null ? null : { providerID: 'p', id: item.model },
    }))
    const snapshot = { sessionID: 'root', complete: true, gaps: [], errors: [], records }
    const modified = { ...snapshot, records: records.map((record) => ({ ...record, model: { providerID: 'other', id: 'changed' } })).reverse() }
    const expected = new Map()
    for (const record of records) {
      const group = expected.get(record.agent) ?? { knownCost: null, incomplete: false }
      if (record.cost === null) group.incomplete = true
      else group.knownCost = (group.knownCost ?? 0) + record.cost
      expected.set(record.agent, group)
    }
    for (const input of [snapshot, modified]) {
      const result = await this.aggregateGeneratedSnapshot(input)
      assert.ok(Array.isArray(result.agents))
      assert.equal(result.agents.length, expected.size)
      const actual = new Map(result.agents.map(({ agent, knownCost, incomplete }) => [agent, { knownCost, incomplete }]))
      assert.equal(actual.size, result.agents.length, 'each agent has one summary')
      assert.deepEqual([...actual.entries()].sort(), [...expected.entries()].sort())
    }
  }), { numRuns: 100 })
})
