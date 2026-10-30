import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import {
  aggregateUsageDetails,
  evaluateCallTierRate,
  extractCallTokens,
  sanitizeText,
} from '../../src/pricing-attribution.js'

test('property: sanitizeText never contains control, line breaking, or invisible characters', () => {
  fc.assert(
    fc.property(fc.string(), (raw) => {
      const sanitized = sanitizeText(raw)
      const hasDisallowed = /[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu.test(sanitized)
      assert.equal(hasDisallowed, false)
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('property: extractCallTokens output always equals output + reasoning when both are non-negative integers', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 10_000_000 }),
      fc.integer({ min: 0, max: 10_000_000 }),
      (out, reasoning) => {
        const res = extractCallTokens({ output: out, reasoning })
        assert.equal(res.output, out + reasoning)
      },
    ),
    { numRuns: 100, seed: 42 },
  )
})

test('property: tier rate evaluation strictly requires context > tier.size', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 10_000, max: 500_000 }),
      fc.integer({ min: 1, max: 50 }),
      fc.integer({ min: 51, max: 100 }),
      (threshold, baseRate, tierRate) => {
        const costList = [
          { tier: { type: 'context', size: threshold }, input: tierRate },
          { input: baseRate },
        ]

        // Below threshold
        const below = evaluateCallTierRate(costList, { input: threshold - 1 })
        assert.equal(below.input, baseRate)

        // Equal to threshold
        const at = evaluateCallTierRate(costList, { input: threshold })
        assert.equal(at.input, baseRate)

        // Strictly above threshold
        const above = evaluateCallTierRate(costList, { input: threshold + 1 })
        assert.equal(above.input, tierRate)
      },
    ),
    { numRuns: 100, seed: 42 },
  )
})

test('property: aggregateUsageDetails order invariance: shuffling records preserves pair count and identities', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          agent: fc.constantFrom('alpha', 'beta', 'gamma'),
          model: fc.constantFrom(
            { providerID: 'p1', id: 'm1' },
            { providerID: 'p1', id: 'm2' },
            { providerID: 'p2', id: 'm1' },
          ),
          cost: fc.double({ min: 0, max: 10, noNaN: true }),
          tokens: fc.record({
            input: fc.integer({ min: 0, max: 100_000 }),
            output: fc.integer({ min: 0, max: 100_000 }),
          }),
        }),
        { minLength: 1, maxLength: 20 },
      ),
      (records) => {
        const shuffled = [...records].reverse()
        const res1 = aggregateUsageDetails(records, [])
        const res2 = aggregateUsageDetails(shuffled, [])

        assert.equal(res1.length, res2.length)
        for (let i = 0; i < res1.length; i++) {
          assert.equal(res1[i].agentDisplay, res2[i].agentDisplay)
          assert.equal(res1[i].modelDisplay, res2[i].modelDisplay)
        }
      },
    ),
    { numRuns: 100, seed: 42 },
  )
})
