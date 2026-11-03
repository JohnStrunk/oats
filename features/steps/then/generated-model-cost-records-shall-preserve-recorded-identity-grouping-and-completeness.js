import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { aggregateModels } from '../model_aggregation_helper.js'

const MAX_DISPLAY_CENTS = 999_999n

function expectedDisplay(dollars) {
  if (dollars === null) return null
  const cents = BigInt(dollars) * 100n
  if (cents > MAX_DISPLAY_CENTS || cents < -MAX_DISPLAY_CENTS) return null
  if (cents === 0n) return '$0.00'
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  return `$${negative ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

Then('generated model-cost records shall preserve recorded-identity grouping and completeness', { timeout: 120000 }, async function () {
  const identifier = fc.constantFrom('alpha-model', 'beta-model', 'Unattributed', '__proto__', null, undefined, '', '   ', 17)
  const item = fc.record({
    modelID: identifier,
    providerID: fc.constantFrom('provider-one', 'provider-two', 'provider-three'),
    agent: fc.constantFrom('alpha', 'beta', 'gamma'),
    cost: fc.oneof(
      fc.integer({ min: -100_000, max: 100_000 }),
      fc.constantFrom(null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '5'),
    ),
  })

  await fc.assert(fc.asyncProperty(fc.array(item, { maxLength: 40 }), async (items) => {
    const records = items.map((entry, index) => ({
      id: `generated-${index}`,
      sessionID: index % 2 ? 'child' : 'root',
      agent: entry.agent,
      model: entry.modelID === null || entry.modelID === undefined
        ? entry.modelID
        : { providerID: entry.providerID, id: entry.modelID },
      cost: entry.cost,
    }))
    const snapshot = { sessionID: 'root', complete: true, gaps: [], errors: [], records }
    const expected = new Map()
    for (const entry of items) {
      const usable = typeof entry.modelID === 'string' && entry.modelID.trim().length > 0
      const key = usable ? entry.modelID : null
      const group = expected.get(key) ?? { knownCost: 0, seen: false, incomplete: false }
      if (typeof entry.cost === 'number' && Number.isFinite(entry.cost)) {
        group.knownCost += entry.cost
        group.seen = true
      } else group.incomplete = true
      expected.set(key, group)
    }

    const result = await aggregateModels(snapshot)
    assert.ok(Array.isArray(result.models))
    const actual = new Map(result.models.map(({ model, knownCost, incomplete, roundedCost }) => [
      model,
      { knownCost, incomplete, roundedCost },
    ]))
    assert.equal(actual.size, result.models.length, 'each usable recorded model identifier has one row')

    const unattributed = expected.get(null) ?? null
    expected.delete(null)
    assert.equal(actual.size, expected.size)
    assert.equal(result.incomplete, Boolean(unattributed) || [...expected.values()].some(group => group.incomplete))
    for (const [model, group] of expected) {
      const actualGroup = actual.get(model)
      assert.ok(actualGroup, `missing model row ${JSON.stringify(model)}`)
      const knownCost = group.seen ? group.knownCost : null
      assert.equal(actualGroup.knownCost, knownCost)
      assert.equal(actualGroup.incomplete, group.incomplete)
      assert.equal(actualGroup.roundedCost, expectedDisplay(knownCost))
    }

    if (unattributed) {
      assert.ok(result.unattributed, 'unusable model identities retain a separate Unattributed group')
      const knownCost = unattributed.seen ? unattributed.knownCost : null
      assert.equal(result.unattributed.knownCost, knownCost)
      assert.equal(result.unattributed.incomplete, unattributed.incomplete)
      assert.equal(result.unattributed.roundedCost, expectedDisplay(knownCost))
    } else assert.equal(result.unattributed, null)
  }), { numRuns: 80, seed: 480048 })
})
