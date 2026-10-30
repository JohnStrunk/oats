import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines } from '../../src/agent-stats.js'

const HOST_WIDTH = 30
const LEGEND = '! = incomplete total'

const snapshot = (records, extra = {}) => ({
  sessionID: 'root',
  records,
  complete: false,
  errors: [],
  gaps: [],
  ...extra,
})

const rowsOf = (lines) => lines.filter((line) => line.includes(': '))

// Independent cell-width oracle for the pinned host: glibc wcwidth in its
// UTF-8 locale and Unicode East_Asian_Width. ASCII printable and the
// ambiguous-width ellipsis occupy one cell; Kana Supplement U+1B000 (EAW=W),
// CJK, and emoji occupy two. Keep these values separate from src/agent-stats.js
// so a classifier regression cannot validate itself.
const HOST_CELL_WIDTHS = new Map([
  [0x2026, 1], // … horizontal ellipsis, ambiguous width rendered as one cell
  [0x1b000, 2], // Kana Supplement, East_Asian_Width W
  [0x4ee3, 2], // 代 CJK
  [0x7406, 2], // 理 CJK
  [0x1f600, 2], // 😀 emoji
  [0xfffd, 1], // � replacement character, ambiguous width
])

const displayWidth = (text) => {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code >= 0x20 && code <= 0x7e) {
      width += 1
      continue
    }
    const known = HOST_CELL_WIDTHS.get(code)
    assert.notEqual(known, undefined, `width oracle lacks U+${code.toString(16).toUpperCase()}`)
    width += known
  }
  return width
}

const labelOf = (row) => row.slice(0, row.indexOf(': '))

const suffixNumber = (row) => {
  const match = labelOf(row).match(/ #([0-9a-z]+)$/)
  return match ? Number.parseInt(match[1], 36) : null
}

test('an unrelated expensive incomplete row does not shorten complete labels', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'research-alpha', cost: 1 },
    { agent: 'research-beta', cost: 2 },
    { agent: 'expensive-research', cost: 1e308 },
    { agent: 'expensive-research', cost: null },
  ]), 'root')
  const rows = rowsOf(lines)

  assert.ok(rows.includes('research-alpha: $1.00'), rows.join('\n'))
  assert.ok(rows.includes('research-beta: $2.00'), rows.join('\n'))
  const expensive = rows.find((row) => row.includes('>$9999.99'))
  assert.ok(expensive?.endsWith(' (incomplete)'), expensive)
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
  assert.ok(!rows.some((row) => row.includes(' #')), 'unrelated labels must not collide')
})

test('an unrelated unknown total does not shorten complete labels', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'research-alpha', cost: 1 },
    { agent: 'research-beta', cost: 2 },
    { agent: 'expensive-research', cost: null },
  ]), 'root')
  const rows = rowsOf(lines)

  assert.ok(rows.includes('research-alpha: $1.00'), rows.join('\n'))
  assert.ok(rows.includes('research-beta: $2.00'), rows.join('\n'))
  const unknown = rows.find((row) => row.includes('unavailable'))
  assert.ok(unknown?.endsWith(' (!)'), unknown)
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
  assert.ok(lines.includes(LEGEND))
})

test('sanitized collisions with different per-agent budgets stay unique', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'a\u200Bb', cost: 1 },
    { agent: 'a�b', cost: 1e308 },
    { agent: 'a�b', cost: null },
  ]), 'root')
  const rows = rowsOf(lines)
  const labels = rows.map(labelOf)

  assert.equal(rows.length, 2)
  assert.equal(new Set(labels).size, 2, rows.join('\n'))
  assert.ok(rows.includes('a�b #1: $1.00'), rows.join('\n'))
  assert.ok(rows.some((row) => row.endsWith(': >$9999.99 (incomplete)')), rows.join('\n'))
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))

  const reversed = agentStatsLines(snapshot([
    { agent: 'a�b', cost: null },
    { agent: 'a�b', cost: 1e308 },
    { agent: 'a\u200Bb', cost: 1 },
  ]), 'root')
  assert.deepEqual([...rows].sort(), [...rowsOf(reversed)].sort())
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
  const rows = rowsOf(lines)
  const labels = rows.map(labelOf)

  assert.equal(new Set(labels).size, labels.length, rows.join('\n'))
  assert.ok(rows.includes('Unattributed: $3.00'), rows.join('\n'))
  assert.ok(rows.includes('a�b #1: $2.00'), rows.join('\n'))
  assert.ok(rows.some((row) => row.startsWith('Unattributed') && !row.startsWith('Unattributed:')))
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
})

test('collision suffixes increase globally in stable name order', () => {
  const names = [
    'abcdefghijklmnop-a', 'abcdefghijklmnop-b',
    'qrstuvwxyzabcdef-a', 'qrstuvwxyzabcdef-b',
  ]
  const lines = agentStatsLines(snapshot(names.map((agent) => ({ agent, cost: 1 }))), 'root')
  const numbers = rowsOf(lines).map(suffixNumber)

  assert.deepEqual(numbers, [1, 2, 3, 4], rowsOf(lines).join('\n'))
})

test('mixed narrow and wide budgets keep every row within 30 columns', () => {
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
  const rows = rowsOf(lines)

  assert.ok(rows.length >= 7)
  for (const row of rows) {
    assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
    assert.ok(!row.endsWith('unavailable'), `amount and status must both remain: ${row}`)
  }
  const usesCompact = rows.some((row) => row.endsWith(' (!)')) ||
    lines.includes(LEGEND)
  assert.equal(usesCompact, lines.includes(LEGEND))
  assert.ok(lines.includes('Summary incomplete'))
})

test('Kana Supplement U+1B000 is reserved as a wide cell in a row', () => {
  const name = `a${'\u{1B000}'.repeat(20)}`
  const cases = [
    {
      records: [{ agent: name, cost: null }],
      amount: 'unavailable',
      marker: ' (!)',
    },
    {
      records: [{ agent: name, cost: 1e308 }, { agent: name, cost: null }],
      amount: '>$9999.99',
      marker: ' (incomplete)',
    },
  ]

  for (const { records, amount, marker } of cases) {
    const rows = rowsOf(agentStatsLines(snapshot(records), 'root'))
    assert.equal(rows.length, 1, JSON.stringify(records))
    const [row] = rows

    assert.ok(row.includes(amount), row)
    assert.ok(row.endsWith(marker), row)
    assert.ok(row.includes('\u{1B000}'), `wide name must remain visible: ${row}`)
    assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
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
      const lines = agentStatsLines(snapshot(records), 'root')
      const rows = rowsOf(lines)
      assert.equal(rows.length, 1, JSON.stringify(records))
      const [row] = rows
      assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
      assert.ok(!row.endsWith('unavailable'), `amount and status must both remain: ${row}`)
    }
  }
})

test('suffix overflow falls back without leaving the 30-column row', { timeout: 7000 }, () => {
  // Every name sanitizes to the same four-cell candidate, so all rows share
  // the smallest per-agent budget. 216^2 names push the global base-36 suffix
  // past that budget, exercising the suffix-only fallback.
  const marks = []
  for (let code = 0x300; code <= 0x2000 && marks.length < 216; code++) {
    const char = String.fromCodePoint(code)
    if (/\p{M}/u.test(char)) marks.push(char)
  }
  assert.equal(marks.length, 216)
  const records = marks.flatMap((first) =>
    marks.map((second) => ({ agent: `a${first}${second}b`, cost: null })))
  const lines = agentStatsLines(snapshot(records), 'root')
  const rows = rowsOf(lines)

  assert.equal(rows.length, records.length)
  assert.equal(new Set(lines).size, lines.length)
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), 'every fallback row must fit')
  assert.ok(rows.some((row) => row.startsWith('#1000:') && row.endsWith(' (!)')),
    'past 36^3 collisions the numeric suffix alone exceeds the budget and compacts the marker')
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
  const rows = rowsOf(lines)

  assert.equal(rows.length, 6000)
  assert.equal(new Set(lines).size, lines.length)
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
  assert.ok(elapsed < 5000, `collision resolution took ${elapsed.toFixed(0)} ms`)

  const reversed = agentStatsLines(snapshot([...records].reverse()), 'root')
  assert.deepEqual([...lines].sort(), [...reversed].sort())
})
