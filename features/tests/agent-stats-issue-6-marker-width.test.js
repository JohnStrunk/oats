import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines } from '../../src/agent-stats.js'
import {
  MAX_HOST_CONTENT_WIDTH,
  costRows,
  legendCount,
  rowFor,
  rowsShareValueEnd,
} from './agent-stats-display-oracle.js'

const snapshot = (records) => ({
  sessionID: 'root',
  records,
  complete: false,
  errors: [],
  gaps: [],
})

test('a long named unknown total keeps its full value and blank marker', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([{ agent: name, cost: null }]), 'root')
  const row = rowFor(lines, name)

  assert.equal(row.value, 'unavailable')
  assert.equal(row.marker, 'blank')
  assert.equal(row.markerSlot, ' ')
  assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
  assert.equal(legendCount(lines), 0, 'unknown totals do not add an e legend')
  assert.ok(lines.includes('Summary incomplete'))
})

test('an unattributed unknown total keeps its full value and blank marker', () => {
  const lines = agentStatsLines(snapshot([{ agent: null, cost: null }]), 'root')
  const row = rowFor(lines, 'Unattributed')

  assert.equal(row.value, 'unavailable')
  assert.equal(row.marker, 'blank')
  assert.equal(row.markerSlot, ' ')
  assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
  assert.equal(legendCount(lines), 0)
})

test('long named and unattributed unknown rows align without an e legend', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'abcdefghijklmnop', cost: null },
    { agent: null, cost: null },
  ]), 'root')
  const rows = costRows(lines)

  assert.equal(rows.length, 2)
  assert.ok(rows.every((row) => row.value === 'unavailable'))
  assert.ok(rows.every((row) => row.marker === 'blank' && row.markerSlot === ' '))
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 0)
})

test('known incomplete totals carry the e marker and its legend', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'partial', cost: 2 },
    { agent: 'partial', cost: null },
  ]), 'root')
  const row = rowFor(lines, 'partial')

  assert.equal(row.value, '$2.00')
  assert.equal(row.marker, 'e')
  assert.equal(row.markerSlot, 'e')
  assert.equal(legendCount(lines), 1)
})

test('named overflow totals keep the e marker and fit the host content edge', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([
    { agent: name, cost: 1e308 },
    { agent: name, cost: null },
  ]), 'root')
  const row = rowFor(lines, name)

  assert.equal(row.value, '>$9999.99')
  assert.equal(row.marker, 'e')
  assert.equal(row.markerSlot, 'e')
  assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
  assert.equal(legendCount(lines), 1)
})

test('unattributed overflow totals keep the e marker and legend', () => {
  const lines = agentStatsLines(snapshot([
    { agent: null, cost: -1e308 },
    { agent: null, cost: null },
  ]), 'root')
  const row = rowFor(lines, 'Unattributed')

  assert.equal(row.value, '<-$9999.99')
  assert.equal(row.marker, 'e')
  assert.equal(row.markerSlot, 'e')
  assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
  assert.equal(legendCount(lines), 1)
})

test('colliding unknown names keep distinct labels and blank markers', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([
    { agent: name, cost: null },
    { agent: `${name} `, cost: null },
  ]), 'root')
  const rows = costRows(lines)

  assert.equal(rows.length, 2)
  assert.equal(new Set(rows.map((row) => row.label)).size, 2)
  assert.ok(rows.every((row) => row.value === 'unavailable'))
  assert.ok(rows.every((row) => row.marker === 'blank' && row.markerSlot === ' '))
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 0)
})

test('every generated row preserves its amount and marker in one row', () => {
  const cases = [
    { agent: 'a', cost: null },
    { agent: 'abcdefghijklmnop', cost: null },
    { agent: 'abcdefghijklmnop', cost: 2 },
    { agent: 'abcdefghijklmnop', cost: 2, incomplete: true },
    { agent: 'abcdefghijklmnop', cost: 1e308, incomplete: true },
    { agent: 'abcdefghijklmnop', cost: -1e308, incomplete: true },
    { agent: '代理代理代理代理', cost: null },
    { agent: null, cost: null },
    { agent: null, cost: 3 },
    { agent: null, cost: 3, incomplete: true },
    { agent: null, cost: 1e308, incomplete: true },
  ]

  for (const { agent, cost, incomplete } of cases) {
    const records = [{ agent, cost }]
    if (incomplete) records.push({ agent, cost: null })
    const lines = agentStatsLines(snapshot(records), 'root')
    const rows = costRows(lines)
    assert.equal(rows.length, 1, JSON.stringify({ agent, cost, incomplete }))
    const [row] = rows

    assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
    assert.equal(row.marker, incomplete ? 'e' : 'blank')
    assert.equal(row.markerSlot, incomplete ? 'e' : ' ')
    assert.ok(!row.line.includes('(!)'), 'the old compact marker must not remain')
    assert.equal(legendCount(lines), incomplete ? 1 : 0)
  }
})
