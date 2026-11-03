import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { aggregateModels } from '../model_aggregation_helper.js'

const MAX_DISPLAY_CENTS = 999_999n

function expectedRounded(units) {
  const quotient = units / 10n
  const cents = units > 0n && units % 10n !== 0n ? quotient + 1n : quotient
  if (cents > MAX_DISPLAY_CENTS || cents < -MAX_DISPLAY_CENTS) return null
  if (cents === 0n) return '$0.00'
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  return `$${negative ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

Then('generated reported model-cost totals shall be rounded upward to whole cents', { timeout: 120000 }, async function () {
  await fc.assert(fc.asyncProperty(
    fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { minLength: 1, maxLength: 40 }),
    async (thousandths) => {
      const records = thousandths.map((units, index) => ({
        id: `rounding-${index}`,
        sessionID: index % 2 ? 'child' : 'root',
        agent: `agent-${index % 3}`,
        model: { providerID: `provider-${index % 4}`, id: 'rounding-model' },
        cost: units / 1000,
      }))
      const totalUnits = thousandths.reduce((sum, units) => sum + BigInt(units), 0n)
      const result = await aggregateModels({
        sessionID: 'root', complete: true, gaps: [], errors: [], records,
      })
      const row = result.models.find(entry => entry.model === 'rounding-model')
      assert.ok(row, 'the recorded model identifier must have a displayed-cost row')
      assert.equal(row.incomplete, false)
      assert.equal(row.roundedCost, expectedRounded(totalUnits))
      if (row.roundedCost === null) {
        assert.equal(row.overflowDirection, totalUnits < 0n ? 'negative' : 'positive')
      } else assert.equal(row.overflowDirection, undefined)
    },
  ), { numRuns: 80, seed: 480049 })
})
