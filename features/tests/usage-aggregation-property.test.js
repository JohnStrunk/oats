import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import {
  entryFor,
  record,
  summarize,
} from './usage-aggregation-fixtures.js'

const HOSTILE_NAMES = [
  'alpha',
  'beta',
  'worker',
  '__proto__',
  'constructor',
  'alpha ',
  '\u202Eevil',
  '💥agent',
]
const agentArb = fc.constantFrom(...HOSTILE_NAMES)
const costArb = fc.integer({ min: -1000, max: 1000 })
const itemArb = fc.record({ agent: agentArb, cost: costArb })
const itemsArb = fc.array(itemArb, { maxLength: 30 })

const recordsFrom = (items) =>
  items.map((item, index) => record(`record-${index}`, item.agent, item.cost))

const normalize = (result) => ({
  sessionID: result.sessionID,
  agents: result.agents
    .map(({ agent, knownCost, incomplete }) => ({
      agent,
      knownCost,
      incomplete,
    }))
    .sort((left, right) =>
      left.agent < right.agent ? -1 : left.agent > right.agent ? 1 : 0,
    ),
  unattributed: result.unattributed
    ? {
        knownCost: result.unattributed.knownCost,
        incomplete: result.unattributed.incomplete,
      }
    : null,
  incomplete: result.incomplete,
})

test('reported totals are invariant under record order', async () => {
  const permuted = itemsArb.chain((items) => {
    const records = recordsFrom(items)
    return fc.tuple(
      fc.constant(records),
      fc.shuffledSubarray(records, {
        minLength: records.length,
        maxLength: records.length,
      }),
    )
  })

  await fc.assert(
    fc.asyncProperty(permuted, async ([ordered, shuffled]) => {
      const first = await summarize(ordered)
      const second = await summarize(shuffled)
      assert.deepEqual(normalize(first), normalize(second))
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('reported totals match a naive per-agent sum', async () => {
  const mixedItems = fc.array(
    fc.record({
      agent: fc.oneof(agentArb, fc.constant(null)),
      cost: fc.oneof(
        costArb,
        fc.constantFrom(
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          null,
          undefined,
          '5',
        ),
      ),
    }),
    { maxLength: 30 },
  )

  await fc.assert(
    fc.asyncProperty(mixedItems, async (items) => {
      const expected = new Map()
      for (const item of items) {
        const named =
          typeof item.agent === 'string' && item.agent.trim().length > 0
        const key = named ? item.agent : null
        const group = expected.get(key) ?? {
          knownCost: 0,
          seen: false,
          incomplete: false,
        }
        if (typeof item.cost === 'number' && Number.isFinite(item.cost)) {
          group.knownCost += item.cost
          group.seen = true
        } else {
          group.incomplete = true
        }
        expected.set(key, group)
      }

      const result = await summarize(recordsFrom(items))
      const unattributed = expected.get(null) ?? null
      expected.delete(null)

      assert.equal(result.agents.length, expected.size)
      for (const [agent, group] of expected) {
        const entry = entryFor(result, agent)
        assert.ok(entry, `missing agent ${JSON.stringify(agent)}`)
        assert.equal(entry.knownCost, group.seen ? group.knownCost : null)
        assert.equal(entry.incomplete, group.incomplete)
      }

      if (unattributed) {
        assert.equal(
          result.unattributed.knownCost,
          unattributed.seen ? unattributed.knownCost : null,
        )
        assert.equal(result.unattributed.incomplete, unattributed.incomplete)
      } else {
        assert.equal(result.unattributed, null)
      }
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('each finite cost is counted exactly once', async () => {
  const countable = fc.array(
    fc.record({ agent: fc.oneof(agentArb, fc.constant(null)), cost: costArb }),
    { maxLength: 30 },
  )

  await fc.assert(
    fc.asyncProperty(countable, async (items) => {
      const expected = items.reduce((sum, item) => sum + item.cost, 0)
      const result = await summarize(recordsFrom(items))
      const reported =
        result.agents.reduce((sum, entry) => sum + entry.knownCost, 0) +
        (result.unattributed?.knownCost ?? 0)

      assert.equal(reported, expected)
      for (const entry of result.agents) {
        assert.ok(Number.isFinite(entry.knownCost))
      }
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('a missing cost changes completeness but not the other known costs', async () => {
  const costsArb = fc.array(fc.integer({ min: 0, max: 1000 }), {
    minLength: 2,
    maxLength: 20,
  })

  await fc.assert(
    fc.asyncProperty(costsArb, async (costs) => {
      const records = costs.map((cost, index) =>
        record(`record-${index}`, 'alpha', cost),
      )
      const broken = records.map((item, index) =>
        index === 0 ? { ...item, cost: null } : item,
      )
      const result = await summarize(broken)

      const expected = costs.slice(1).reduce((sum, cost) => sum + cost, 0)
      assert.equal(entryFor(result, 'alpha').knownCost, expected)
      assert.equal(entryFor(result, 'alpha').incomplete, true)
      assert.equal(result.incomplete, true)
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('model and descendant session changes do not change attribution', async () => {
  await fc.assert(
    fc.asyncProperty(itemsArb, async (items) => {
      const records = recordsFrom(items)
      const changed = records.map((item, index) => ({
        ...item,
        sessionID: index % 2 ? 'child' : 'grandchild',
        model: { providerID: 'other', id: `model-${index}` },
      }))

      assert.deepEqual(
        normalize(await summarize(records)),
        normalize(await summarize(changed)),
      )
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('arbitrary unicode names are preserved and kept distinct', async () => {
  const pairsArb = fc.array(
    fc.tuple(
      fc
        .string({ unit: 'grapheme', minLength: 1, maxLength: 12 })
        .filter((name) => name.trim().length > 0),
      fc.integer({ min: 0, max: 100 }),
    ),
    { maxLength: 15 },
  )

  await fc.assert(
    fc.asyncProperty(pairsArb, async (pairs) => {
      const records = pairs.map(([agent, cost], index) =>
        record(`record-${index}`, agent, cost),
      )
      const expected = new Map()
      for (const [agent, cost] of pairs) {
        expected.set(agent, (expected.get(agent) ?? 0) + cost)
      }

      const result = await summarize(records)
      assert.equal(result.agents.length, expected.size)
      for (const [agent, cost] of expected) {
        assert.equal(entryFor(result, agent)?.knownCost, cost)
      }
    }),
    { numRuns: 100, seed: 42 },
  )
})

test('nonfinite inputs never produce a nonfinite known cost', async () => {
  const hostileCostArb = fc.oneof(
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.constantFrom(
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      null,
      undefined,
      '5',
    ),
  )
  const hostileItems = fc.array(
    fc.record({ agent: fc.oneof(agentArb, fc.constant(null)), cost: hostileCostArb }),
    { maxLength: 30 },
  )

  await fc.assert(
    fc.asyncProperty(hostileItems, async (items) => {
      const result = await summarize(recordsFrom(items))
      const known = [
        ...result.agents.map((entry) => entry.knownCost),
        result.unattributed?.knownCost,
      ].filter((cost) => cost !== null && cost !== undefined)

      for (const cost of known) {
        assert.ok(Number.isFinite(cost), `nonfinite known cost ${cost}`)
      }
    }),
    { numRuns: 100, seed: 42 },
  )
})
