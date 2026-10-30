import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import {
  aggregateReportedCosts,
  aggregateReportedCostsForDisplay,
  formatReportedCost,
} from '../../src/usage-aggregation.js'
import { entryFor, record, snapshot } from './usage-aggregation-fixtures.js'

const MAX_DISPLAY_CENTS = 999_999n

const display = (records, overrides) =>
  aggregateReportedCostsForDisplay(snapshot(records, overrides))

const displayed = (costs, agent = 'alpha') =>
  entryFor(display(costs.map((cost, index) => record(`${index}`, agent, cost))), agent)
    .roundedCost

const withoutRounded = (summary) => ({
  ...summary,
  agents: summary.agents.map(({ agent, knownCost, incomplete }) => ({
    agent,
    knownCost,
    incomplete,
  })),
  unattributed: summary.unattributed
    ? {
        knownCost: summary.unattributed.knownCost,
        incomplete: summary.unattributed.incomplete,
      }
    : null,
})

test('sums shortest decimal representations before rounding the total', () => {
  for (const [costs, expected] of [
    [[0.1, 0.2], '$0.30'],
    [[0.001, 0.001], '$0.01'],
    [[0.009, 0.002], '$0.02'],
    [[1.005, 0.005], '$1.01'],
    [[0.07, 0.01], '$0.08'],
    [[1.15], '$1.15'],
    [[1.250001], '$1.26'],
    [[1.25], '$1.25'],
    [[12.5], '$12.50'],
  ]) {
    assert.equal(displayed(costs), expected, costs.join(' + '))
  }
})

test('does not round individual records before aggregation', () => {
  assert.equal(displayed([0.001, 0.001, 0.001]), '$0.01')
  assert.equal(displayed([0.004, 0.004]), '$0.01')
  assert.equal(displayed([0.009, 0.009]), '$0.02')
  assert.equal(displayed([0.001, 0.001]), '$0.01')
  assert.equal(displayed([0.004, 0.004, 0.004]), '$0.02')
})

test('rounds negative totals toward positive infinity', () => {
  for (const [costs, expected] of [
    [[-0.001], '$0.00'],
    [[-Number.MIN_VALUE], '$0.00'],
    [[-0.01], '$-0.01'],
    [[-0.01001], '$-0.01'],
    [[-0.011], '$-0.01'],
    [[-1.25], '$-1.25'],
    [[-1.25001], '$-1.25'],
    [[-0.008], '$0.00'],
    [[-0.018], '$-0.01'],
    [[-0.01, -0.001], '$-0.01'],
  ]) {
    assert.equal(displayed(costs), expected, costs.join(' + '))
  }
})

test('handles zero, negative zero, and exact cents without a rounded artifact', () => {
  assert.equal(displayed([0]), '$0.00')
  assert.equal(displayed([-0]), '$0.00')
  assert.equal(displayed([0, 0, 0]), '$0.00')
  assert.equal(displayed([-0.01, 0.01]), '$0.00')
})

test('handles the smallest subnormal without losing its positive cent', () => {
  const single = display([record('1', 'alpha', Number.MIN_VALUE)])
  assert.equal(entryFor(single, 'alpha').knownCost, Number.MIN_VALUE)
  assert.equal(entryFor(single, 'alpha').roundedCost, '$0.01')
  assert.equal(entryFor(single, 'alpha').incomplete, false)

  assert.equal(displayed([Number.MIN_VALUE, Number.MIN_VALUE]), '$0.01')
})

test('bounds the largest finite value without exposing an unbounded amount', () => {
  const maximum = display([record('1', 'alpha', Number.MAX_VALUE)])
  const entry = entryFor(maximum, 'alpha')
  assert.equal(entry.knownCost, Number.MAX_VALUE)
  assert.equal(entry.roundedCost, null, 'the exact cent total exceeds the display bound')
  assert.equal(entry.incomplete, false, 'display overflow is not missing input data')
  assert.equal(maximum.incomplete, false)

  assert.equal(displayed([-Number.MAX_VALUE]), null)
})

test('identifies display overflow direction without changing completeness', () => {
  const positive = display([record('1', 'alpha', 10_000)]).agents[0]
  assert.equal(positive.roundedCost, null)
  assert.equal(positive.overflowDirection, 'positive')
  assert.equal(positive.incomplete, false)

  const negative = display([record('1', 'alpha', -10_000)]).agents[0]
  assert.equal(negative.roundedCost, null)
  assert.equal(negative.overflowDirection, 'negative')
  assert.equal(negative.incomplete, false)

  const missing = display([record('1', 'alpha', null)]).agents[0]
  assert.equal(missing.roundedCost, null)
  assert.equal(missing.overflowDirection, undefined)
  assert.equal(missing.incomplete, true)
})

test('formats a single reported value with the same decimal rounding', () => {
  assert.equal(formatReportedCost(0.005), '$0.01')
  assert.equal(formatReportedCost(1.25), '$1.25')
  assert.equal(formatReportedCost(-0.0001), '$0.00')
  assert.equal(formatReportedCost(1e308), '>$9999.99')
  assert.equal(formatReportedCost(-1e308), '<-$9999.99')
  assert.equal(formatReportedCost(null), 'unavailable')
  assert.equal(formatReportedCost(Number.NaN), 'unavailable')
})

test('keeps numeric overflow semantics while rounding exactly', () => {
  const overflow = display([
    record('1', 'alpha', Number.MAX_VALUE),
    record('2', 'alpha', Number.MAX_VALUE),
  ])
  assert.equal(entryFor(overflow, 'alpha').knownCost, null)
  assert.equal(entryFor(overflow, 'alpha').roundedCost, null)
  assert.equal(entryFor(overflow, 'alpha').incomplete, true)
  assert.equal(overflow.incomplete, true)

  const cancelled = display([
    record('1', 'alpha', Number.MAX_VALUE),
    record('2', 'alpha', -Number.MAX_VALUE),
  ])
  assert.equal(entryFor(cancelled, 'alpha').knownCost, 0)
  assert.equal(entryFor(cancelled, 'alpha').roundedCost, '$0.00')
  assert.equal(entryFor(cancelled, 'alpha').incomplete, false)
})

test('applies the bounded display edge around the largest displayed total', () => {
  assert.equal(displayed([9_999.99]), '$9999.99')
  assert.equal(displayed([9_999.9901]), null)
  assert.equal(displayed([-9_999.9901]), '$-9999.99')
  assert.equal(displayed([-10_000]), null)
  assert.equal(displayed([10_000]), null)
})

test('keeps rounded output in plain bounded dollar notation', () => {
  const result = display(
    [
      record('1', 'alpha', 0.1),
      record('2', 'alpha', 0.2),
      record('3', 'beta', 1e300),
      record('4', 'gamma', null),
      record('5', null, 0.001),
    ],
  )

  for (const entry of [...result.agents, result.unattributed]) {
    if (entry?.roundedCost !== null) {
      assert.match(entry.roundedCost, /^\$-?\d+\.\d{2}$/)
    }
  }
})

test('adds roundedCost without changing the aggregation summary', () => {
  const records = [
    record('1', 'alpha', 0.1),
    record('2', 'alpha', 0.2),
    record('3', 'beta', 5),
    record('4', 'beta', null),
    record('5', null, 0.001),
    record('6', '__proto__', -1.25),
  ]
  const input = snapshot(records, {
    complete: false,
    gaps: [{ kind: 'historical-usage-unavailable', sessionID: 'child' }],
  })
  const base = aggregateReportedCosts(input)
  const shown = aggregateReportedCostsForDisplay(input)

  assert.deepEqual(withoutRounded(shown), base)
  assert.equal(entryFor(shown, 'alpha').roundedCost, '$0.30')
  assert.equal(entryFor(shown, 'beta').roundedCost, '$5.00')
  assert.equal(entryFor(shown, 'beta').knownCost, 5)
  assert.equal(entryFor(shown, 'beta').incomplete, true)
  assert.equal(entryFor(shown, '__proto__').roundedCost, '$-1.25')
  assert.equal(shown.unattributed.roundedCost, '$0.01')
  assert.equal(shown.unattributed.incomplete, false)
  assert.equal(shown.incomplete, true)
})

test('leaves roundedCost null when no cost is known', () => {
  const missing = display([record('1', 'alpha', null)])
  assert.equal(entryFor(missing, 'alpha').knownCost, null)
  assert.equal(entryFor(missing, 'alpha').roundedCost, null)

  const absent = display([record('1', 'alpha', undefined)])
  assert.equal(entryFor(absent, 'alpha').roundedCost, null)

  const invalid = display([record('1', 'alpha', Number.NaN)])
  assert.equal(entryFor(invalid, 'alpha').roundedCost, null)
})

test('rounds the unattributed bucket and handles its absence', () => {
  const present = display([
    record('1', null, 0.1),
    record('2', undefined, 0.2),
  ])
  assert.deepEqual(present.agents, [])
  assert.equal(present.unattributed.knownCost, 0.30000000000000004)
  assert.equal(present.unattributed.roundedCost, '$0.30')
  assert.equal(present.unattributed.incomplete, false)

  const absent = display([record('1', 'alpha', 2)])
  assert.equal(absent.unattributed, null)
})

test('returns an empty display summary when no session is displayed', () => {
  const result = display([], { sessionID: null })
  assert.deepEqual(result, {
    sessionID: null,
    agents: [],
    unattributed: null,
    incomplete: false,
  })
})

test('does not mutate the supplied snapshot', () => {
  const input = snapshot([
    record('1', 'alpha', 0.1),
    record('2', 'alpha', 0.2),
  ])
  const before = structuredClone(input)
  aggregateReportedCostsForDisplay(input)
  assert.deepEqual(input, before)
})

const thousandths = fc.integer({ min: -1_000_000, max: 1_000_000 })
const namedAgent = fc.oneof(
  fc.constantFrom('alpha', 'beta', '__proto__', '💥agent'),
  fc.constant(null),
)
const decimalItems = fc.array(
  fc.record({ agent: namedAgent, units: thousandths }),
  { maxLength: 30 },
)

const recordsFrom = (items) =>
  items.map((item, index) =>
    record(`record-${index}`, item.agent, item.units / 1000),
  )

function expectedRounded(units) {
  const quotient = units / 10n
  const cents = units > 0n && units % 10n !== 0n ? quotient + 1n : quotient
  if (cents > MAX_DISPLAY_CENTS || cents < -MAX_DISPLAY_CENTS) return null
  if (cents === 0n) return '$0.00'
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  return `$${negative ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

test('rounded totals match an independent exact thousandths reference', async () => {
  await fc.assert(
    fc.asyncProperty(decimalItems, async (items) => {
      const result = aggregateReportedCostsForDisplay(snapshot(recordsFrom(items)))
      const groups = new Map()
      for (const item of items) {
        const key =
          typeof item.agent === 'string' && item.agent.trim().length > 0
            ? item.agent
            : null
        groups.set(key, (groups.get(key) ?? 0n) + BigInt(item.units))
      }

      for (const entry of result.agents) {
        assert.equal(
          entry.roundedCost,
          expectedRounded(groups.get(entry.agent)),
          `agent ${JSON.stringify(entry.agent)}`,
        )
      }
      const unattributed = groups.get(null)
      assert.equal(
        result.unattributed?.roundedCost ?? null,
        unattributed === undefined ? null : expectedRounded(unattributed),
      )
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('display totals and rounded costs are invariant under record order', async () => {
  const permuted = decimalItems.chain((items) => {
    const records = recordsFrom(items)
    return fc.tuple(
      fc.constant(records),
      fc.shuffledSubarray(records, {
        minLength: records.length,
        maxLength: records.length,
      }),
    )
  })

  const normalize = (result) => ({
    ...result,
    agents: [...result.agents].sort((left, right) =>
      left.agent < right.agent ? -1 : left.agent > right.agent ? 1 : 0,
    ),
  })

  await fc.assert(
    fc.asyncProperty(permuted, async ([ordered, shuffled]) => {
      assert.deepEqual(
        normalize(aggregateReportedCostsForDisplay(snapshot(ordered))),
        normalize(aggregateReportedCostsForDisplay(snapshot(shuffled))),
      )
    }),
    { numRuns: 100, seed: 42 },
  )
})
