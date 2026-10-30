import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { assertHeading, eventually, modal, refreshPair } from '../usage_details_helper.js'

Then('generated pair reported costs shall be summed before display', { timeout: 90000 }, async function () {
  await modal(this)
  await fc.assert(fc.asyncProperty(
    fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 8 }),
    async cents => {
      const expected = cents.reduce((a, b) => a + b, 0)
      for (const values of [cents, [expected + 10000], [...cents].reverse()]) {
        const sum = values.reduce((a, b) => a + b, 0)
        const observed = `$${Math.floor(sum / 100)}.${String(sum % 100).padStart(2, '0')}`
        await refreshPair(this, values)
        const text = await eventually(this, frame => frame.split('\n').some(line => line.includes('alpha') && line.includes('fixture-model') && line.includes(observed)), `generated pair must show ${observed}`)
        assertHeading(text, 'alpha', 'fixture-model', observed)
        assert.equal((text.match(/alpha\s+-\s+/g) ?? []).length, 1)
      }
    },
  ), { numRuns: 8, seed: 35035, endOnFailure: true })
})
