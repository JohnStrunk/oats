import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { displayedValue, eventually, rowFor, setTinyCost, updateControl } from '../sidebar_scenario_helper.js'

Then('generated costs beyond the display limit shall show the appropriate directional bound', { timeout: 180000 }, async function () {
  await fc.assert(fc.asyncProperty(
    fc.integer({ min: 10000, max: 1000000000 }), fc.boolean(),
    async (magnitude, negative) => {
      await updateControl(this, fixture => setTinyCost(fixture, 0))
      await eventually(this, text => displayedValue(rowFor(text, 'tiny')) === '$0.00', 'the zero control was not displayed')
      await updateControl(this, fixture => setTinyCost(fixture, negative ? -magnitude : magnitude))
      const bound = negative ? '<-$9999.99' : '>$9999.99'
      await eventually(this, text => {
        const value = displayedValue(rowFor(text, 'tiny'))
        return value === bound
      }, `cost ${negative ? -magnitude : magnitude} must show the bound ${bound}`)
    },
  ), { numRuns: 20, seed: 6110, endOnFailure: true })
})
