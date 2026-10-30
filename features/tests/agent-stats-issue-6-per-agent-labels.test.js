import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines } from '../../src/agent-stats.js'
import {
  MAX_HOST_CONTENT_WIDTH,
  costRows,
  displayWidth,
  legendCount,
  rowFor,
  rowsShareValueEnd,
} from './agent-stats-display-oracle.js'

const snapshot = (records, extra = {}) => ({
  sessionID: 'root',
  records,
  complete: false,
  errors: [],
  gaps: [],
  ...extra,
})

const suffixNumber = (label) => {
  const match = label.match(/ #([0-9a-z]+)$/)
  return match ? Number.parseInt(match[1], 36) : null
}

test('an unrelated expensive incomplete row does not shorten complete labels', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'research-alpha', cost: 1 },
    { agent: 'research-beta', cost: 2 },
    { agent: 'expensive-research', cost: 1e308 },
    { agent: 'expensive-research', cost: null },
  ]), 'root')
  const rows = costRows(lines)

  assert.equal(rowFor(lines, 'research-alpha').value, '$1.00')
  assert.equal(rowFor(lines, 'research-beta').value, '$2.00')
  const expensive = rows.find((row) => row.value === '>$9999.99')
  assert.equal(expensive.marker, 'e')
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.ok(!rows.some((row) => row.label.includes(' #')), 'unrelated labels must not collide')
  assert.equal(legendCount(lines), 1)
})

test('an unrelated unknown total does not shorten complete labels', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'research-alpha', cost: 1 },
    { agent: 'research-beta', cost: 2 },
    { agent: 'expensive-research', cost: null },
  ]), 'root')
  const rows = costRows(lines)

  assert.equal(rowFor(lines, 'research-alpha').value, '$1.00')
  assert.equal(rowFor(lines, 'research-beta').value, '$2.00')
  const unknown = rows.find((row) => row.value === 'unavailable')
  assert.equal(unknown.marker, 'blank')
  assert.equal(unknown.markerSlot, ' ')
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 0)
})

test('sanitized collisions with different per-agent budgets stay unique', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'a\u200Bb', cost: 1 },
    { agent: 'a�b', cost: 1e308 },
    { agent: 'a�b', cost: null },
  ]), 'root')
  const rows = costRows(lines)
  const labels = rows.map((row) => row.label)

  assert.equal(rows.length, 2)
  assert.equal(new Set(labels).size, 2, rows.join('\n'))
  const known = rows.find((row) => row.value === '$1.00')
  const overflow = rows.find((row) => row.value === '>$9999.99')
  assert.equal(known.label, 'a�b #1')
  assert.equal(overflow.marker, 'e')
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 1)

  const reversed = agentStatsLines(snapshot([
    { agent: 'a�b', cost: null },
    { agent: 'a�b', cost: 1e308 },
    { agent: 'a\u200Bb', cost: 1 },
  ]), 'root')
  assert.deepEqual(
    rows.map((row) => row.line).sort(),
    costRows(reversed).map((row) => row.line).sort(),
  )
})

test('a collided label never reuses a unique candidate or the reserved bucket', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'a\u200Bb', cost: 1 },
    { agent: 'a�b', cost: 1e308 },
    { agent: 'a�b', cost: null },
    { agent: 'a�b #1', cost: 2 },
    { agent: 'Unattributed', cost: 4 },
    { agent: null, cost: 3 },
  ]), 'root')
  const rows = costRows(lines)
  const labels = rows.map((row) => row.label)

  assert.equal(new Set(labels).size, labels.length, rows.join('\n'))
  assert.equal(rowFor(lines, 'Unattributed').value, '$3.00')
  assert.ok(rows.some((row) => row.label.startsWith('Unattributed') && row.label !== 'Unattributed'))
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 1)
})

test('collision suffixes increase globally in stable name order', () => {
  const names = [
    'abcdefghijklmnop-a', 'abcdefghijklmnop-b',
    'qrstuvwxyzabcdef-a', 'qrstuvwxyzabcdef-b',
  ]
  const lines = agentStatsLines(snapshot(names.map((agent) => ({ agent, cost: 1 }))), 'root')
  const numbers = costRows(lines).map((row) => suffixNumber(row.label))

  assert.deepEqual(numbers, [1, 2, 3, 4], costRows(lines).map((row) => row.label).join('\n'))
})

test('mixed narrow and wide budgets keep every row within the host content edge', () => {
  const records = [
    { agent: 'research-alpha', cost: 1 },
    { agent: 'research-beta', cost: 2 },
    { agent: 'expensive-incomplete', cost: 1e308 },
    { agent: 'expensive-incomplete', cost: null },
    { agent: 'unknown-long-agent-name', cost: null },
    { agent: '代理代理代理代理代理', cost: 3 },
    { agent: '代理代理代理代理代理', cost: null },
    { agent: 'Unattributed', cost: 5 },
    { agent: null, cost: 4 },
    { agent: null, cost: -1e308 },
    { agent: null, cost: null },
  ]
  const lines = agentStatsLines(snapshot(records), 'root')
  const rows = costRows(lines)

  assert.ok(rows.length >= 7)
  for (const row of rows) {
    assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
    assert.ok(row.markerSlot === (row.marker === 'e' ? 'e' : ' '), row.line)
    assert.ok(!row.line.includes('(!)'), row.line)
  }
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  const usesMarker = rows.some((row) => row.marker === 'e')
  assert.equal(usesMarker, legendCount(lines) === 1)
  assert.ok(lines.includes('Summary incomplete'))
})

test('Kana Supplement U+1B000 is reserved as a wide cell in a row', () => {
  const name = `a${'\u{1B000}'.repeat(20)}`
  const cases = [
    {
      records: [{ agent: name, cost: null }],
      amount: 'unavailable',
      marker: 'blank',
    },
    {
      records: [{ agent: name, cost: 1e308 }, { agent: name, cost: null }],
      amount: '>$9999.99',
      marker: 'e',
    },
  ]

  for (const { records, amount, marker } of cases) {
    const rows = costRows(agentStatsLines(snapshot(records), 'root'))
    assert.equal(rows.length, 1, JSON.stringify(records))
    const [row] = rows

    assert.equal(row.value, amount)
    assert.equal(row.marker, marker)
    assert.equal(row.markerSlot, marker === 'e' ? 'e' : ' ')
    assert.ok(row.label.includes('\u{1B000}'), `wide name must remain visible: ${row.line}`)
    assert.ok(row.width <= MAX_HOST_CONTENT_WIDTH, `${row.width} columns: ${row.line}`)
  }
})

test('rows fit an independent host-width oracle across scripts', () => {
  const names = [
    'ascii-agent',
    '代理代理代理代理代理',
    `a${'\u{1B000}'.repeat(20)}`,
    '😀'.repeat(10),
    'alpha\u200Bbeta',
    'plain',
  ]
  const variants = (agent) => [
    [{ agent, cost: null }],
    [{ agent, cost: 1e308 }, { agent, cost: null }],
    [{ agent, cost: 1 }],
  ]

  for (const agent of names) {
    for (const records of variants(agent)) {
      const rows = costRows(agentStatsLines(snapshot(records), 'root'))
      assert.equal(rows.length, 1, JSON.stringify(records))
      const [row] = rows
      assert.ok(displayWidth(row.line) <= MAX_HOST_CONTENT_WIDTH,
        `${displayWidth(row.line)} columns: ${row.line}`)
      assert.equal(row.markerSlot, row.marker === 'e' ? 'e' : ' ')
    }
  }
})

test('massive collisions stay unique and bounded', { timeout: 7000 }, () => {
  // Every name sanitizes to the same four-cell candidate, so all rows share
  // the smallest per-agent budget.
  const marks = []
  for (let code = 0x300; code <= 0x2000 && marks.length < 216; code++) {
    const char = String.fromCodePoint(code)
    if (/\p{M}/u.test(char)) marks.push(char)
  }
  assert.equal(marks.length, 216)
  const records = marks.flatMap((first) =>
    marks.map((second) => ({ agent: `a${first}${second}b`, cost: null })))
  const lines = agentStatsLines(snapshot(records), 'root')
  const rows = costRows(lines)

  assert.equal(rows.length, records.length)
  assert.equal(new Set(rows.map((row) => row.label)).size, rows.length)
  assert.ok(rowsShareValueEnd(rows), 'all fallback rows must share the value column')
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), 'every row must fit')
  assert.ok(rows.every((row) => row.marker === 'blank'))
  assert.equal(legendCount(lines), 0)
})

test('thousands of mixed-budget colliding rows resolve uniquely and quickly', { timeout: 7000 }, () => {
  const records = []
  for (let i = 0; i < 6000; i++) {
    const agent = `worker-${i}`
    records.push({ agent, cost: 1 })
    if (i % 2 === 1) {
      records.push({ agent, cost: 1e308 })
      records.push({ agent, cost: null })
    }
  }
  const start = performance.now()
  const lines = agentStatsLines(snapshot(records), 'root')
  const elapsed = performance.now() - start
  const rows = costRows(lines)

  assert.equal(rows.length, 6000)
  assert.equal(new Set(rows.map((row) => row.label)).size, rows.length)
  assert.ok(rowsShareValueEnd(rows), rows.join('\n'))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.join('\n'))
  assert.equal(legendCount(lines), 1)
  assert.ok(elapsed < 5000, `collision resolution took ${elapsed.toFixed(0)} ms`)

  const reversed = agentStatsLines(snapshot([...records].reverse()), 'root')
  assert.deepEqual([...lines].sort(), [...reversed].sort())
})
