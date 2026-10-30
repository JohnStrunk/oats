import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import { agentStatsLines, formatCost } from '../../src/agent-stats.js'
import { costRows, legendCount, rowFor } from './agent-stats-display-oracle.js'

const record = (id, agent, cost, sessionID = 'root') => ({
  id: `${sessionID}/${id}`,
  sessionID,
  messageID: id,
  agent,
  model: { providerID: 'provider', id: 'model' },
  cost,
  tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
  source: 'assistant',
})

const snapshot = (records, overrides = {}) => ({
  sessionID: 'root',
  records,
  complete: records.every((entry) => entry.cost != null),
  errors: [],
  gaps: [],
  ...overrides,
})

const valueFor = (lines, label) => rowFor(lines, label)?.value ?? ''
const markerFor = (lines, label) => rowFor(lines, label)?.marker ?? ''

test('formats reported costs as US dollars with at least two decimals', () => {
  assert.equal(formatCost(0), '$0.00')
  assert.equal(formatCost(1), '$1.00')
  assert.equal(formatCost(1.25), '$1.25')
  assert.equal(formatCost(12.5), '$12.50')
  assert.equal(formatCost(0.005), '$0.01')
  assert.equal(formatCost(1.005), '$1.01')
  assert.equal(formatCost(2.675), '$2.68')
})

test('rounds every positive sub-cent record up to one cent', () => {
  for (const cost of [0.0001, 1e-7, 1e-21, 0.004999, 4.2e-9]) {
    assert.equal(formatCost(cost), '$0.01', `${cost} must round toward positive infinity`)
  }
})

test('rounds negative records toward positive infinity without inventing a charge', () => {
  assert.equal(formatCost(-0.001), '$0.00')
  assert.equal(formatCost(-0.0001), '$0.00')
  assert.equal(formatCost(-0.0099), '$0.00')
  assert.equal(formatCost(-0.01), '$-0.01')
  assert.equal(formatCost(-0.0101), '$-0.01')
  assert.equal(formatCost(-1.25), '$-1.25')
  assert.equal(formatCost(null), 'unavailable')
  assert.equal(formatCost(undefined), 'unavailable')
  assert.equal(formatCost(Number.NaN), 'unavailable')
  assert.equal(formatCost(Number.POSITIVE_INFINITY), 'unavailable')
})

test('every generated positive reported cost is displayed as nonzero cents or an upper bound', () => {
  fc.assert(
    fc.property(
      fc.double({
        min: Number.MIN_VALUE,
        max: 10_000,
        noNaN: true,
        noDefaultInfinity: true,
      }),
      (cost) => {
        const displayed = formatCost(cost)
        if (cost > 9999.99) {
          assert.equal(displayed, '>$9999.99')
          return
        }
        assert.match(displayed, /^\$\d+\.\d{2}$/)
        assert.ok(Number(displayed.slice(1)) > 0)
        assert.notEqual(displayed, '$0.00')
      },
    ),
    { numRuns: 500 },
  )
})

test('sums reported decimal records exactly before rounding once to cents', () => {
  const lines = agentStatsLines(
    snapshot([
      record('sum-a', 'sum', 0.1),
      record('sum-b', 'sum', 0.2),
      record('halves-a', 'halves', 0.005),
      record('halves-b', 'halves', 0.005),
      record('subcent-a', 'subcent', 0.001),
      record('subcent-b', 'subcent', 0.001),
      record('many-a', 'many', 0.1),
      record('many-b', 'many', 0.2),
      record('many-c', 'many', 0.3),
      record('negative-a', 'negative', -0.1),
      record('negative-b', 'negative', -0.2),
    ]),
    'root',
  )

  assert.equal(valueFor(lines, 'sum'), '$0.30')
  assert.equal(valueFor(lines, 'halves'), '$0.01')
  assert.equal(valueFor(lines, 'subcent'), '$0.01')
  assert.equal(valueFor(lines, 'many'), '$0.60')
  assert.equal(valueFor(lines, 'negative'), '$-0.30')
})

test('bounds displayed totals above $9999.99 and below -$9999.99', () => {
  assert.equal(formatCost(9999.99), '$9999.99')
  assert.equal(formatCost(9999.9901), '>$9999.99')
  assert.equal(formatCost(9999.995), '>$9999.99')
  assert.equal(formatCost(-9999.99), '$-9999.99')
  assert.equal(formatCost(-9999.9901), '$-9999.99')
  assert.equal(formatCost(-9999.995), '$-9999.99')
  assert.equal(formatCost(10_000), '>$9999.99')
  assert.equal(formatCost(-10_000), '<-$9999.99')
  assert.equal(formatCost(1e21), '>$9999.99')
  assert.equal(formatCost(-1e21), '<-$9999.99')
})

test('uses the display bounds for agent totals as well as single values', () => {
  const lines = agentStatsLines(
    snapshot([
      record('over', 'over', 10_000),
      record('under', 'under', -10_000),
    ]),
    'root',
  )

  assert.equal(valueFor(lines, 'over'), '>$9999.99')
  assert.equal(valueFor(lines, 'under'), '<-$9999.99')
})

test('shows one combined row per recorded agent name', () => {
  const lines = agentStatsLines(
    snapshot([
      record('root-alpha', 'alpha', 1),
      record('child-alpha', 'alpha', 7, 'child'),
      record('child-worker', 'worker', 2, 'child'),
    ]),
    'root',
  )

  assert.equal(costRows(lines).filter((row) => row.label === 'alpha').length, 1)
  assert.equal(valueFor(lines, 'alpha'), '$8.00')
  assert.equal(valueFor(lines, 'worker'), '$2.00')
})

test('presents a stale snapshot as loading instead of the previous session totals', () => {
  const lines = agentStatsLines(
    snapshot([record('alpha', 'alpha', 1)], { complete: true }),
    'new-root',
  )

  assert.deepEqual(lines, ['Loading session history…'])
  assert.ok(!lines.some((line) => line.includes('alpha')), 'old totals must not be shown')
})

test('distinguishes empty, unavailable and loading history', () => {
  const empty = agentStatsLines(snapshot([], { complete: true }), 'root')
  const unavailable = agentStatsLines(
    snapshot([], {
      complete: false,
      errors: [{ operation: 'message.list', sessionID: 'root', message: 'history unavailable' }],
    }),
    'root',
  )
  const loading = agentStatsLines(snapshot([], { complete: true }), 'other')

  assert.ok(empty.some((line) => line.includes('No agent usage recorded')))
  assert.ok(!empty.some((line) => /loading|unavailable/i.test(line)))
  assert.ok(unavailable.some((line) => line.includes('Session history unavailable')))
  assert.ok(!unavailable.some((line) => line.includes('No agent usage recorded')))
  assert.deepEqual(loading, ['Loading session history…'])
  assert.notDeepEqual(empty, loading)
  assert.notDeepEqual(empty, unavailable)
})

test('identifies incomplete agent totals without turning missing cost into zero', () => {
  const lines = agentStatsLines(
    snapshot([record('partial-1', 'partial', 2), record('partial-2', 'partial', null)]),
    'root',
  )

  assert.equal(valueFor(lines, 'partial'), '$2.00')
  assert.equal(markerFor(lines, 'partial'), 'e')
  assert.equal(legendCount(lines), 1)
  assert.ok(lines.includes('Summary incomplete'))
})

test('identifies an agent with no known cost as unavailable without an e marker', () => {
  const lines = agentStatsLines(snapshot([record('unknown', 'unknown', null)]), 'root')
  const unknown = rowFor(lines, 'unknown')

  assert.equal(unknown.value, 'unavailable')
  assert.equal(unknown.marker, 'blank')
  assert.ok(!unknown.line.includes('$0.00'), 'unknown cost must not be presented as zero')
  assert.equal(legendCount(lines), 0, 'unknown totals do not add an e legend')
  assert.ok(lines.includes('Summary incomplete'))
})

test('keeps unknown agent identity visible as unattributed work', () => {
  const lines = agentStatsLines(snapshot([record('anonymous', null, 3)]), 'root')

  assert.equal(valueFor(lines, 'Unattributed'), '$3.00')
  assert.ok(!lines.some((line) => line.startsWith('null:')))
  assert.ok(lines.includes('Summary incomplete'))
})

test('sanitizes agent names so history cannot inject terminal control sequences', () => {
  const lines = agentStatsLines(
    snapshot([record('hostile', 'alpha\u001b[31m\nbeta', 1)]),
    'root',
  )

  const rows = costRows(lines)
  assert.equal(rows.length, 1)
  assert.equal(lines.length, 1)
  assert.ok(!lines[0].includes('\u001b'))
  assert.ok(!lines[0].includes('\n'))
  assert.equal(rows[0].value, '$1.00')
  assert.match(rows[0].label, /^alpha.*beta$/)
})
