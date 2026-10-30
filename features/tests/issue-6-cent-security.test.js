import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines, formatCost } from '../../src/agent-stats.js'
import {
  MAX_HOST_CONTENT_WIDTH,
  costRows,
  legendCount,
  rowFor,
  rowsShareValueEnd,
} from './agent-stats-display-oracle.js'

const snapshot = (records = [], fields = {}) => ({
  sessionID: 'root', complete: true, records, errors: [], gaps: [], ...fields,
})

test('reported decimal costs round upward exactly to cents', () => {
  for (const [value, expected] of [
    [0, '$0.00'], [0.07, '$0.07'], [0.29, '$0.29'], [1.23, '$1.23'],
    [0.07000000000000002, '$0.08'], [0.001, '$0.01'], [Number.MIN_VALUE, '$0.01'],
    [1.231, '$1.24'], [-0.001, '$0.00'], [-0.07, '$-0.07'],
    [-0.071, '$-0.07'], [-1.231, '$-1.23'], [-Number.MIN_VALUE, '$0.00'],
    [9999.99, '$9999.99'], [9999.991, '>$9999.99'],
    [-9999.991, '$-9999.99'], [-10000, '<-$9999.99'],
    [1e308, '>$9999.99'], [-1e308, '<-$9999.99'],
  ]) assert.equal(formatCost(value), expected, String(value))
})

test('decimal totals are summed exactly before rounding once', () => {
  for (const [costs, expected] of [
    [[0.1, 0.2], '$0.30'], [[0.001, 0.001], '$0.01'],
    [[0.009, 0.002], '$0.02'], [[1.005, 0.005], '$1.01'],
    [[-0.1, -0.2], '$-0.30'], [[0.3, -0.2], '$0.10'],
  ]) {
    const lines = agentStatsLines(snapshot(costs.map(cost => ({ agent: 'a', cost }))), 'root')
    assert.equal(rowFor(lines, 'a').value, expected, `${costs} produced ${lines}`)
  }
})

test('overflow and partial totals stay distinguishable in the sidebar', () => {
  const records = [
    { agent: 'abcdefghijklmnop', cost: 1e308 }, { agent: 'abcdefghijklmnop', cost: null },
    { agent: null, cost: -1e308 }, { agent: null, cost: null },
  ]
  const lines = agentStatsLines(snapshot(records, { complete: false }), 'root')
  const row = rowFor(lines, 'abcdefghijklmnop')
  const bucket = rowFor(lines, 'Unattributed')

  assert.equal(row.value, '>$9999.99')
  assert.equal(row.marker, 'e')
  assert.equal(bucket.value, '<-$9999.99')
  assert.equal(bucket.marker, 'e')
  assert.equal(legendCount(lines), 1)
  assert.ok(rowsShareValueEnd(costRows(lines)))
  assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH)
  assert.ok(bucket.width <= MAX_HOST_CONTENT_WIDTH)
  assert.ok(lines.includes('Summary incomplete'))
})

test('zero-width marks cannot spoof a label or the unattributed bucket', () => {
  const agents = ['Unattributed', 'Unattributed\uFE0F', 'Unattributed\u034F', 'worker', 'worker\uFE0F', 'worker\u034F', 'worker�']
  const lines = agentStatsLines(
    snapshot([...agents.map((agent, i) => ({ agent, cost: i + 1 })), { agent: null, cost: 8 }]),
    'root',
  )
  const labels = costRows(lines).map((row) => row.label)

  assert.equal(labels.length, agents.length + 1)
  assert.equal(new Set(labels).size, labels.length)
  assert.equal(rowFor(lines, 'Unattributed').value, '$8.00')
  assert.ok(labels.every((label) => !/[\p{M}\p{Default_Ignorable_Code_Point}]/u.test(label)))
})

test('thousands of colliding display names resolve in near-linear time', { timeout: 7000 }, () => {
  const records = Array.from({ length: 6000 }, (_, i) => ({ agent: `abcdefghijklmnop${i}`, cost: 1 }))
  const start = performance.now()
  const lines = agentStatsLines(snapshot(records), 'root')
  const elapsed = performance.now() - start
  const rows = costRows(lines)
  assert.equal(rows.length, records.length)
  assert.equal(new Set(rows.map((row) => row.label)).size, records.length)
  assert.ok(rowsShareValueEnd(rows))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH))
  assert.equal(legendCount(lines), 0)
  assert.ok(elapsed < 5000, `collision resolution took ${elapsed.toFixed(0)} ms`)
})

test('150,000 agent rows do not exceed argument limits', { timeout: 30000 }, () => {
  const records = Array.from({ length: 150000 }, (_, i) => ({ agent: `agent-${i}`, cost: 0 }))
  const lines = agentStatsLines(snapshot(records), 'root')
  assert.equal(lines.length, records.length)
  assert.equal(new Set(lines).size, records.length)
})

test('empty history accepts only the two documented benign gap kinds', () => {
  const benign = ['historical-usage-unavailable', 'retry-history-unavailable']
  const good = agentStatsLines(snapshot([], { complete: false, gaps: benign.map(kind => ({ kind })) }), 'root')
  assert.ok(good.includes('No agent usage recorded'))
  assert.ok(good.includes('Summary incomplete'))
  for (const gap of ['fork-provenance-uncertain', 'future-unknown-gap', 'compaction-usage-incomplete']) {
    const result = agentStatsLines(snapshot([], { complete: false, gaps: [{ kind: gap }] }), 'root')
    assert.ok(result.includes('Session history unavailable'), gap)
    assert.ok(!result.includes('No agent usage recorded'))
  }
  const error = agentStatsLines(snapshot([], { complete: false, gaps: [{ kind: benign[0] }], errors: [{}] }), 'root')
  assert.ok(error.includes('Session history unavailable'))
  const noEvidence = agentStatsLines(snapshot([], { complete: false }), 'root')
  assert.ok(noEvidence.includes('Session history unavailable'))
})
