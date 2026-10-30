import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { displayedValue, eventually, rowFor, setTinyCost, updateControl } from '../sidebar_scenario_helper.js'

Then('every generated positive sub-cent cost shall be displayed as one cent', { timeout: 180000 }, async function () {
  await fc.assert(fc.asyncProperty(fc.oneof(
    fc.constant(Number.MIN_VALUE),
    fc.integer({ min: 3, max: 323 }).map(exponent => 10 ** -exponent),
  ), async cost => {
    // Zero between cases prevents a stale previous one-cent row from passing.
    await updateControl(this, fixture => setTinyCost(fixture, 0))
    await eventually(this, text => displayedValue(rowFor(text, 'tiny')) === '$0.00', 'the zero control was not displayed')
    await updateControl(this, fixture => setTinyCost(fixture, cost))
    await eventually(this, text => displayedValue(rowFor(text, 'tiny')) === '$0.01',
      `positive sub-cent reported cost ${cost} was not rendered as exactly $0.01`)
  }), { numRuns: 20, seed: 6106, endOnFailure: true })
})
