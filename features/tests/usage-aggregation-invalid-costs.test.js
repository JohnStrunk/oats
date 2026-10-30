import assert from 'node:assert/strict'
import test from 'node:test'
import { entryFor, record, summarize } from './usage-aggregation-fixtures.js'

const INVALID_COSTS = [
  ['NaN', Number.NaN],
  ['positive infinity', Number.POSITIVE_INFINITY],
  ['negative infinity', Number.NEGATIVE_INFINITY],
  ['numeric string', '5'],
  ['zero string', '0'],
  ['boolean', true],
  ['plain object', {}],
  ['array', []],
  ['bigint', 5n],
  ['boxed number', new Number(5)],
]

for (const [label, cost] of INVALID_COSTS) {
  test(`treats ${label} as an unknown cost, not a reported value`, async () => {
    const result = await summarize([
      record('known', 'alpha', 2),
      record('invalid', 'alpha', cost),
    ])

    assert.equal(entryFor(result, 'alpha').knownCost, 2)
    assert.equal(entryFor(result, 'alpha').incomplete, true)
    assert.equal(result.incomplete, true)
  })
}

test('does not turn an invalid-only cost into a known zero', async () => {
  const result = await summarize([record('1', 'alpha', Number.NaN)])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(result.incomplete, true)
})

test('treats undefined and an absent cost property as missing', async () => {
  const result = await summarize([
    record('1', 'alpha', undefined),
    { id: '2', sessionID: 'root', agent: 'alpha' },
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(result.incomplete, true)
})

test('does not let a nonfinite cost poison known sibling costs', async () => {
  const result = await summarize([
    record('1', 'alpha', 5),
    record('2', 'alpha', Number.NaN),
    record('3', 'alpha', 2),
  ])

  const total = entryFor(result, 'alpha').knownCost
  assert.equal(total, 7)
  assert.ok(Number.isFinite(total))
  assert.equal(entryFor(result, 'alpha').incomplete, true)
})

test('retains individual finite costs at extreme scales', async () => {
  for (const cost of [Number.MIN_VALUE, 1e-300, 1e300, Number.MAX_VALUE]) {
    const result = await summarize([record('1', 'alpha', cost)])
    assert.equal(entryFor(result, 'alpha').knownCost, cost)
    assert.equal(entryFor(result, 'alpha').incomplete, false)
    assert.equal(result.incomplete, false)
  }
})

test('treats an overflowing known total as unusable rather than infinity', async () => {
  const result = await summarize([
    record('1', 'alpha', Number.MAX_VALUE),
    record('2', 'alpha', Number.MAX_VALUE),
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(result.incomplete, true)
})

test('treats a negative overflowing known total as unusable', async () => {
  const result = await summarize([
    record('1', 'alpha', -Number.MAX_VALUE),
    record('2', 'alpha', -Number.MAX_VALUE),
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
})

test('contains an overflow to the affected agent', async () => {
  const result = await summarize([
    record('1', 'alpha', Number.MAX_VALUE),
    record('2', 'alpha', Number.MAX_VALUE),
    record('3', 'beta', 7),
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(entryFor(result, 'beta').knownCost, 7)
  assert.equal(entryFor(result, 'beta').incomplete, false)
  assert.equal(result.incomplete, true)
})

test('keeps negative zero as a reported zero', async () => {
  const result = await summarize([record('1', 'alpha', -0)])

  assert.equal(entryFor(result, 'alpha').knownCost, 0)
  assert.ok(
    Object.is(entryFor(result, 'alpha').knownCost, 0),
    'negative zero must not reach the presented total',
  )
  assert.equal(entryFor(result, 'alpha').incomplete, false)
})

test('keeps an invalid unattributed cost unknown and incomplete', async () => {
  const result = await summarize([record('1', null, Number.POSITIVE_INFINITY)])

  assert.equal(result.unattributed.knownCost, null)
  assert.equal(result.unattributed.incomplete, true)
  assert.equal(result.incomplete, true)
})

test('never exposes a nonfinite known cost', async () => {
  const result = await summarize([
    record('1', 'alpha', Number.MAX_VALUE),
    record('2', 'alpha', Number.MAX_VALUE),
    record('3', 'beta', Number.NaN),
    record('4', 'gamma', 3),
    record('5', null, Number.NEGATIVE_INFINITY),
  ])

  const known = [
    ...result.agents.map((entry) => entry.knownCost),
    result.unattributed?.knownCost,
  ].filter((cost) => cost !== null && cost !== undefined)
  assert.ok(known.length > 0)
  for (const cost of known) {
    assert.ok(Number.isFinite(cost), `nonfinite known cost ${cost}`)
  }
})
