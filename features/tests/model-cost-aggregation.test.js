import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import { record, snapshot } from './usage-aggregation-fixtures.js'

const MAX_DISPLAY_CENTS = 999_999n

async function aggregateModels(input) {
  const boundary = await import('../../src/usage-aggregation.js')
  assert.equal(
    typeof boundary.aggregateReportedCostsByModelForDisplay,
    'function',
    'the public usage-aggregation boundary must expose model reported-cost rows for display',
  )
  return boundary.aggregateReportedCostsByModelForDisplay(input)
}

const modelRecord = (id, agent, modelID, cost, providerID = 'provider-one', sessionID = 'root', extra = {}) =>
  record(id, agent, cost, {
    sessionID,
    model: modelID === undefined ? undefined : modelID === null ? null : { providerID, id: modelID },
    ...extra,
  })

const modelEntry = (summary, name) => summary.models.find(entry => entry.model === name)

function expectedIntegerDisplay(dollars) {
  if (dollars === null) return null
  const cents = BigInt(dollars) * 100n
  if (cents > MAX_DISPLAY_CENTS || cents < -MAX_DISPLAY_CENTS) return null
  if (cents === 0n) return '$0.00'
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  return `$${negative ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

function normalizeModelRows(summary) {
  return summary.models
    .map(({ model, knownCost, incomplete, roundedCost, overflowDirection }) => ({
      model,
      knownCost,
      incomplete,
      roundedCost,
      ...(overflowDirection ? { overflowDirection } : {}),
    }))
    .sort((left, right) => left.model < right.model ? -1 : left.model > right.model ? 1 : 0)
}

test('groups the recorded model identifier across providers, agents and sessions', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('root-a', 'alpha', 'shared', 1, 'provider-one', 'root'),
    modelRecord('child-b', 'beta', 'shared', 2, 'provider-two', 'child'),
    modelRecord('grandchild-c', 'gamma', 'shared', 4, 'provider-three', 'grandchild'),
    modelRecord('root-other', 'alpha', 'different', 3, 'provider-one', 'root'),
  ]))

  assert.deepEqual(normalizeModelRows(result), [
    { model: 'different', knownCost: 3, incomplete: false, roundedCost: '$3.00' },
    { model: 'shared', knownCost: 7, incomplete: false, roundedCost: '$7.00' },
  ])
  assert.equal(result.unattributed, null)
  assert.equal(result.incomplete, false)
})

test('preserves missing and unusable model identifiers as one unattributed group', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('missing', 'alpha', null, 2),
    modelRecord('blank', 'beta', '', 3),
    modelRecord('whitespace', 'gamma', '   ', null),
    modelRecord('non-string', 'delta', 17, 4),
    modelRecord('provider-only', 'epsilon', undefined, 0, 'provider-only'),
    modelRecord('literal-unattributed', 'zeta', 'Unattributed', 7),
  ]))

  assert.deepEqual(result.models, [{
    model: 'Unattributed', knownCost: 7, incomplete: false, roundedCost: '$7.00',
  }])
  assert.equal(result.unattributed.knownCost, 9)
  assert.equal(result.unattributed.incomplete, true)
  assert.equal(result.unattributed.roundedCost, '$9.00')
  assert.equal(result.incomplete, true)
})

test('keeps known zero, known partial and wholly unknown costs distinct', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('zero', 'alpha', 'zero-model', 0),
    modelRecord('partial-known', 'beta', 'partial-model', 2.5),
    modelRecord('partial-missing', 'gamma', 'partial-model', null, 'provider-two'),
    modelRecord('partial-nan', 'delta', 'partial-model', Number.NaN, 'provider-three'),
    modelRecord('unknown', 'epsilon', 'unknown-model', null),
    modelRecord('unknown-infinite', 'zeta', 'unknown-model', Number.POSITIVE_INFINITY, 'provider-two'),
  ]))

  assert.deepEqual(modelEntry(result, 'zero-model'), {
    model: 'zero-model', knownCost: 0, incomplete: false, roundedCost: '$0.00',
  })
  assert.deepEqual(modelEntry(result, 'partial-model'), {
    model: 'partial-model', knownCost: 2.5, incomplete: true, roundedCost: '$2.50',
  })
  assert.deepEqual(modelEntry(result, 'unknown-model'), {
    model: 'unknown-model', knownCost: null, incomplete: true, roundedCost: null,
  })
  assert.equal(result.incomplete, true)
})

test('rounds the exact decimal sum once toward positive infinity', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('binary-one', 'alpha', 'binary-sum', 0.1),
    modelRecord('binary-two', 'beta', 'binary-sum', 0.2, 'provider-two'),
    modelRecord('cent-one', 'alpha', 'cent-sum', 0.009),
    modelRecord('cent-two', 'beta', 'cent-sum', 0.002, 'provider-two'),
    modelRecord('negative', 'alpha', 'negative', -0.01001),
    modelRecord('negative-sub-cent', 'alpha', 'negative-sub-cent', -0.001),
    modelRecord('smallest', 'alpha', 'smallest', Number.MIN_VALUE),
    modelRecord('exact', 'alpha', 'exact', -1.25),
  ]))

  assert.equal(modelEntry(result, 'binary-sum').roundedCost, '$0.30')
  assert.equal(modelEntry(result, 'cent-sum').roundedCost, '$0.02')
  assert.equal(modelEntry(result, 'negative').roundedCost, '$-0.01')
  assert.equal(modelEntry(result, 'negative-sub-cent').roundedCost, '$0.00')
  assert.equal(modelEntry(result, 'smallest').roundedCost, '$0.01')
  assert.equal(modelEntry(result, 'exact').roundedCost, '$-1.25')
})

test('distinguishes numeric overflow from finite display overflow', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('numeric-one', 'alpha', 'numeric-overflow', Number.MAX_VALUE),
    modelRecord('numeric-two', 'beta', 'numeric-overflow', Number.MAX_VALUE, 'provider-two'),
    modelRecord('numeric-negative-one', 'alpha', 'negative-numeric-overflow', -Number.MAX_VALUE),
    modelRecord('numeric-negative-two', 'beta', 'negative-numeric-overflow', -Number.MAX_VALUE, 'provider-two'),
    modelRecord('display-positive', 'alpha', 'display-positive', 10_000),
    modelRecord('display-negative', 'beta', 'display-negative', -10_000),
    modelRecord('display-partial', 'gamma', 'display-partial', 10_000),
    modelRecord('display-partial-missing', 'gamma', 'display-partial', null),
  ]))

  assert.deepEqual(modelEntry(result, 'numeric-overflow'), {
    model: 'numeric-overflow', knownCost: null, incomplete: true, roundedCost: null,
  })
  assert.deepEqual(modelEntry(result, 'negative-numeric-overflow'), {
    model: 'negative-numeric-overflow', knownCost: null, incomplete: true, roundedCost: null,
  })
  assert.deepEqual(modelEntry(result, 'display-positive'), {
    model: 'display-positive', knownCost: 10_000, incomplete: false,
    roundedCost: null, overflowDirection: 'positive',
  })
  assert.deepEqual(modelEntry(result, 'display-negative'), {
    model: 'display-negative', knownCost: -10_000, incomplete: false,
    roundedCost: null, overflowDirection: 'negative',
  })
  assert.deepEqual(modelEntry(result, 'display-partial'), {
    model: 'display-partial', knownCost: 10_000, incomplete: true,
    roundedCost: null, overflowDirection: 'positive',
  })
})

test('keeps unassignable snapshot gaps out of row-level completeness', async () => {
  const result = await aggregateModels(snapshot([
    modelRecord('known-one', 'alpha', 'first-model', 2),
    modelRecord('known-two', 'beta', 'second-model', 3, 'provider-two', 'child'),
  ], {
    complete: false,
    gaps: [{ kind: 'historical-usage-unavailable', sessionID: 'child' }],
  }))

  assert.equal(modelEntry(result, 'first-model').incomplete, false)
  assert.equal(modelEntry(result, 'second-model').incomplete, false)
  assert.equal(result.incomplete, true)
})

test('generated integer costs obey provider-independent grouping and incomplete-cost invariants', async () => {
  const identity = fc.constantFrom('alpha-model', 'beta-model', 'Unattributed', '__proto__', null, undefined, '', '   ', 17)
  const item = fc.record({
    modelID: identity,
    providerID: fc.constantFrom('provider-one', 'provider-two', 'provider-three'),
    agent: fc.constantFrom('alpha', 'beta', 'gamma'),
    cost: fc.oneof(
      fc.integer({ min: -100_000, max: 100_000 }),
      fc.constantFrom(null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '5'),
    ),
  })

  await fc.assert(fc.asyncProperty(fc.array(item, { maxLength: 35 }), async (items) => {
    const records = items.map((entry, index) => modelRecord(
      `generated-${index}`,
      entry.agent,
      entry.modelID,
      entry.cost,
      entry.providerID,
      index % 2 ? 'child' : 'root',
    ))
    const expected = new Map()
    for (const entry of items) {
      const usable = typeof entry.modelID === 'string' && entry.modelID.trim().length > 0
      const key = usable ? entry.modelID : null
      const group = expected.get(key) ?? { total: 0, seen: false, incomplete: false }
      if (typeof entry.cost === 'number' && Number.isFinite(entry.cost)) {
        group.total += entry.cost
        group.seen = true
      } else group.incomplete = true
      expected.set(key, group)
    }

    const result = await aggregateModels(snapshot(records))
    const actual = new Map(normalizeModelRows(result).map(row => [row.model, row]))
    const unattributed = expected.get(null) ?? null
    expected.delete(null)
    assert.equal(actual.size, expected.size)
    assert.equal(result.incomplete, Boolean(unattributed) || [...expected.values()].some(group => group.incomplete))

    for (const [model, group] of expected) {
      const actualGroup = actual.get(model)
      assert.ok(actualGroup, `missing model row ${JSON.stringify(model)}`)
      const knownCost = group.seen ? group.total : null
      assert.equal(actualGroup.knownCost, knownCost)
      assert.equal(actualGroup.incomplete, group.incomplete)
      assert.equal(actualGroup.roundedCost, expectedIntegerDisplay(knownCost))
      if (knownCost !== null && Math.abs(knownCost) > 9_999.99) {
        assert.equal(actualGroup.overflowDirection, knownCost < 0 ? 'negative' : 'positive')
      }
    }

    if (unattributed) {
      const knownCost = unattributed.seen ? unattributed.total : null
      assert.equal(result.unattributed?.knownCost, knownCost)
      assert.equal(result.unattributed?.incomplete, unattributed.incomplete)
      assert.equal(result.unattributed?.roundedCost, expectedIntegerDisplay(knownCost))
    } else assert.equal(result.unattributed, null)
  }), { numRuns: 100, seed: 480048 })
})
