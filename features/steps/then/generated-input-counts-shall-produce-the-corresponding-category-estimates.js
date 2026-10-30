import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { eventually, markedNumbers, modal, refreshInput, rowNumbers } from '../usage_details_helper.js'

Then('generated input counts shall produce the corresponding category estimates', { timeout: 90000 }, async function () {
  await modal(this)
  await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 10 }), async units => {
    const input = units * 200000
    await refreshInput(this, input)
    const text = await eventually(this, frame => {
      const counts = rowNumbers(frame, 'Tokens')
      const costs = rowNumbers(frame, 'Cost')
      return counts.length === 4 && counts[0] === input && costs.length === 4 && costs[0] === units
    }, `input ${input} at $5 per million must estimate $${units}`)
    assert.equal(rowNumbers(text, 'Price')[0], 5)
    assert.equal(rowNumbers(text, 'Cost')[0], units)
    assert.equal(markedNumbers(text, 'Cost'), 4)
  }), { numRuns: 8, seed: 35036, endOnFailure: true })
})
