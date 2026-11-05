import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { assertNumericTableAlignment, eventually, formattedCount, modal, refreshTokenAlignment } from '../usage_details_helper.js'
import { model } from '../usage_details_fixture.js'

Then('generated usage details values shall remain right-aligned with a reserved optional e marker cell', { timeout: 120000 }, async function () {
  await modal(this)
  const tokenCount = fc.oneof(
    fc.constantFrom(0n, 1n, 9n, 10n, 999n, 1000n, 999999n, 1000000n, 999999999n, 9999999999n),
    fc.bigInt({ min: 0n, max: 9999999999n }),
  ).map(Number)
  const values = fc.tuple(tokenCount, tokenCount, tokenCount, tokenCount)
  let sequence = 0

  await fc.assert(fc.asyncProperty(values, fc.integer({ min: 0, max: 15 }), async (counts, incompleteMask) => {
    const caseNumber = sequence++
    const agent = await refreshTokenAlignment(this, counts, incompleteMask, caseNumber)
    const expectedCounts = counts.map(formattedCount)
    const text = await eventually(this, frame => {
      if (!frame.includes(`${agent} - ${model.providerID}/${model.id}`)) return false
      const tokenRow = frame.split('\n').find(line => /^\s*[│|]?\s*Tokens\b/i.test(line)) ?? ''
      return expectedCounts.every(count => tokenRow.includes(count))
    }, `the real host must render generated token values for ${agent}`)
    assertNumericTableAlignment(text, counts, incompleteMask)
  }), { numRuns: 12, seed: 640064, endOnFailure: true })
})
