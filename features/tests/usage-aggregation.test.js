import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregate,
  deepFreeze,
  entryFor,
  record,
  snapshot,
  sortedTotals,
  summarize,
} from './usage-aggregation-fixtures.js'

test('sums repeated names across sessions and models without adding tree totals', async () => {
  const result = await summarize([
    record('r1', 'alpha', 2, { model: { providerID: 'p', id: 'one' } }),
    record('r2', 'alpha', 3, {
      sessionID: 'child',
      model: { providerID: 'p', id: 'two' },
    }),
    record('r3', 'beta', 7, {
      sessionID: 'grandchild',
      model: { providerID: 'p', id: 'two' },
    }),
    record('r4', 'alpha', 5, {
      sessionID: 'grandchild',
      model: { providerID: 'p', id: 'one' },
    }),
  ])

  assert.deepEqual(sortedTotals(result), [
    ['alpha', 10],
    ['beta', 7],
  ])
  assert.equal(result.agents.length, 2, 'one summary per distinct recorded name')
  for (const entry of result.agents) assert.equal(entry.incomplete, false)
  assert.equal(result.incomplete, false)
})

test('attributes nested delegated work to the agent that performed it', async () => {
  const result = await summarize([
    record('root-call', 'alpha', 1),
    record('child-call', 'worker', 3, { sessionID: 'child' }),
    record('child-call-2', 'worker', 3, { sessionID: 'child2' }),
    record('grandchild-call', 'nested', 4, { sessionID: 'grandchild' }),
  ])

  assert.deepEqual(sortedTotals(result), [
    ['alpha', 1],
    ['nested', 4],
    ['worker', 6],
  ])
  assert.equal(result.incomplete, false)
})

test('retains a reported zero and keeps it distinct from a missing cost', async () => {
  const result = await summarize([
    record('1', 'zero', 0),
    record('2', 'missing', null),
  ])

  const zero = entryFor(result, 'zero')
  const missing = entryFor(result, 'missing')
  assert.equal(zero.knownCost, 0)
  assert.ok(Object.is(zero.knownCost, 0), 'a reported zero is positive zero')
  assert.equal(zero.incomplete, false)
  assert.equal(missing.knownCost, null)
  assert.equal(missing.incomplete, true)
  assert.equal(result.incomplete, true)
})

test('retains a known partial total when another cost is missing', async () => {
  const result = await summarize([
    record('1', 'alpha', 5),
    record('2', 'alpha', null),
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, 5)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(result.incomplete, true)
})

test('does not present a missing cost as a known zero', async () => {
  const result = await summarize([record('1', 'alpha', null)])

  assert.equal(entryFor(result, 'alpha').knownCost, null)
  assert.equal(entryFor(result, 'alpha').incomplete, true)
  assert.equal(result.incomplete, true)
})

test('counts distinct records with identical usage separately', async () => {
  const shared = {
    sessionID: 'root',
    agent: 'alpha',
    cost: 4,
    model: { providerID: 'p', id: 'one' },
  }
  const result = await summarize([
    { ...shared, id: 'call-one' },
    { ...shared, id: 'call-two' },
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, 8)
  assert.equal(entryFor(result, 'alpha').incomplete, false)
})

test('preserves costs without a recorded identity as unattributed', async () => {
  const result = await summarize([
    record('1', 'alpha', 2),
    record('2', null, 3, { sessionID: 'child' }),
    record('3', undefined, 4, { sessionID: 'child' }),
  ])

  assert.deepEqual(sortedTotals(result), [['alpha', 2]])
  assert.equal(result.unattributed.knownCost, 7)
  assert.equal(result.unattributed.incomplete, false)
})

test('keeps a zero unattributed cost distinct from having no unattributed work', async () => {
  const zero = await summarize([record('1', null, 0)])
  assert.equal(zero.unattributed.knownCost, 0)
  assert.ok(Object.is(zero.unattributed.knownCost, 0))
  assert.equal(zero.unattributed.incomplete, false)

  const absent = await summarize([record('1', 'alpha', 2)])
  assert.equal(absent.unattributed, null)
})

test('marks the unattributed total incomplete when its cost is missing', async () => {
  const result = await summarize([
    record('1', null, 2),
    record('2', null, null),
  ])

  assert.equal(result.unattributed.knownCost, 2)
  assert.equal(result.unattributed.incomplete, true)
  assert.equal(result.incomplete, true)
})

test('makes only the summary incomplete for an unassignable source gap', async () => {
  const result = await summarize([record('1', 'alpha', 2)], {
    complete: false,
    gaps: [{ kind: 'historical-usage-unavailable', sessionID: 'child' }],
  })

  assert.equal(entryFor(result, 'alpha').knownCost, 2)
  assert.equal(
    entryFor(result, 'alpha').incomplete,
    false,
    'a gap with no agent attribution must not mark known agents incomplete',
  )
  assert.equal(result.incomplete, true)
})

test('treats gaps and errors as summary-level incompleteness only', async () => {
  const incompleteFlag = await summarize([record('1', 'alpha', 2)], {
    complete: false,
  })
  assert.equal(entryFor(incompleteFlag, 'alpha').incomplete, false)
  assert.equal(incompleteFlag.incomplete, true)

  const gapOnly = await summarize([record('1', 'alpha', 2)], {
    gaps: [{ kind: 'historical-usage-unavailable', sessionID: 'child' }],
  })
  assert.equal(entryFor(gapOnly, 'alpha').incomplete, false)
  assert.equal(gapOnly.incomplete, true)

  const errorOnly = await summarize([record('1', 'alpha', 2)], {
    errors: [{ kind: 'host-read-failed', sessionID: 'child' }],
  })
  assert.equal(entryFor(errorOnly, 'alpha').incomplete, false)
  assert.equal(errorOnly.incomplete, true)
})

test('tolerates absent gap and error collections when the data is complete', async () => {
  const result = await summarize([record('1', 'alpha', 2)], {
    gaps: undefined,
    errors: undefined,
  })

  assert.equal(entryFor(result, 'alpha').incomplete, false)
  assert.equal(result.incomplete, false)
})

test('does not count a gap cost as another reported cost', async () => {
  const result = await summarize(
    [
      record('1', 'alpha', 2),
      record('2', null, 3, { source: 'compaction' }),
    ],
    {
      complete: false,
      gaps: [
        {
          kind: 'compaction-usage-overlap',
          sessionID: 'root',
          eventID: 'e1',
          cost: 3,
        },
      ],
    },
  )

  assert.deepEqual(sortedTotals(result), [['alpha', 2]])
  assert.equal(result.unattributed.knownCost, 3)
  assert.equal(result.incomplete, true)
})

test('returns an empty summary when no session is displayed', async () => {
  const result = await summarize([], { sessionID: null })

  assert.equal(result.sessionID, null)
  assert.deepEqual(result.agents, [])
  assert.equal(result.unattributed, null)
  assert.equal(result.incomplete, false)
})

test('isolates summaries and does not retain state between snapshots', async () => {
  const firstRecords = [record('1', 'old', 50)]
  const first = await summarize(firstRecords)

  const second = await summarize([record('2', 'new', 3)], {
    sessionID: 'other',
  })
  assert.equal(second.sessionID, 'other')
  assert.deepEqual(sortedTotals(second), [['new', 3]])

  const again = await summarize(firstRecords)
  assert.equal(again.sessionID, 'root')
  assert.deepEqual(sortedTotals(again), sortedTotals(first))
})

test('uses a later snapshot value instead of adding it to the earlier one', async () => {
  const before = await summarize([record('1', 'alpha', 2)])
  const after = await summarize([record('1', 'alpha', 7)])

  assert.equal(entryFor(before, 'alpha').knownCost, 2)
  assert.equal(entryFor(after, 'alpha').knownCost, 7)
})

test('does not mutate or alias the input snapshot', async () => {
  const input = snapshot([
    record('1', 'alpha', 5, { model: { providerID: 'p', id: 'one' } }),
    record('2', 'beta', 7, { model: { providerID: 'p', id: 'two' } }),
  ])
  const before = structuredClone(input)
  deepFreeze(input)

  const result = await aggregate(input)
  assert.equal(entryFor(result, 'alpha').knownCost, 5)
  assert.deepEqual(input, before, 'aggregation must not reorder or change input')

  entryFor(result, 'alpha').knownCost = 99
  const again = await aggregate(input)
  assert.equal(
    entryFor(again, 'alpha').knownCost,
    5,
    'returned entries must not alias input records',
  )
})

test('sums finite decimal costs without inventing precision', async () => {
  const result = await summarize([
    record('1', 'alpha', 0.1),
    record('2', 'alpha', 0.2),
  ])

  const total = entryFor(result, 'alpha').knownCost
  assert.ok(Math.abs(total - 0.3) < 1e-12, `unexpected decimal total ${total}`)
  assert.equal(entryFor(result, 'alpha').incomplete, false)
})

test('sums negative finite reported costs as reported', async () => {
  const result = await summarize([
    record('1', 'alpha', -5),
    record('2', 'alpha', 2),
  ])

  assert.equal(entryFor(result, 'alpha').knownCost, -3)
  assert.equal(entryFor(result, 'alpha').incomplete, false)
})
