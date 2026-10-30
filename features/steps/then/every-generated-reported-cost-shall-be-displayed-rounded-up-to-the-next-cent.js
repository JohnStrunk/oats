import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { displayedValue, eventually, rowFor, setTinyCost, updateControl } from '../sidebar_scenario_helper.js'

Then('every generated reported cost shall be displayed rounded up to the next cent', { timeout: 180000 }, async function () {
  // Integer ten-thousandths provide an exact decimal oracle, including both
  // signs and exact cent boundaries, without multiplying binary floats by 100.
  await fc.assert(fc.asyncProperty(
    fc.tuple(fc.integer({ min: -10000, max: 10000 }), fc.constantFrom(0, 1, 99, -1, -99)),
    async ([baseCents, offset]) => {
      const units = baseCents * 100 + offset
      const cents = Math.ceil(units / 100)
      const sign = cents < 0 ? '-' : ''
      const magnitude = Math.abs(cents)
      const expected = `$${sign}${Math.floor(magnitude / 100)}.${String(magnitude % 100).padStart(2, '0')}`
      // Force a different visible value between cases, including zero cases.
      const controlCost = cents === 0 ? 1 : 0
      const control = controlCost ? '$1.00' : '$0.00'
      await updateControl(this, fixture => setTinyCost(fixture, controlCost))
      await eventually(this, text => displayedValue(rowFor(text, 'tiny')) === control, 'the control amount was not displayed')
      await updateControl(this, fixture => setTinyCost(fixture, units / 10000))
      await eventually(this, text => displayedValue(rowFor(text, 'tiny')) === expected,
        `reported cost ${units}/10000 must display exactly ${expected}`)
    },
  ), { numRuns: 30, seed: 6107, endOnFailure: true })
})
