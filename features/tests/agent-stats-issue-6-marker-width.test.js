import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines } from '../../src/agent-stats.js'

const HOST_WIDTH = 30
const LEGEND = '! = incomplete total'

const snapshot = (records) => ({
  sessionID: 'root',
  records,
  complete: false,
  errors: [],
  gaps: [],
})

const isWide = (code) => code >= 0x1100 && (
  code <= 0x115f || code === 0x2329 || code === 0x232a ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe10 && code <= 0xfe6f) ||
  (code >= 0xff01 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6) ||
  (code >= 0x1f000 && code <= 0x1faff) ||
  (code >= 0x20000 && code <= 0x3fffd)
)

const displayWidth = (text) => {
  let width = 0
  for (const char of text) width += isWide(char.codePointAt(0)) ? 2 : 1
  return width
}

const agentRow = (lines) => lines.find((line) => line.includes(': '))

test('a long named unknown total keeps its compact marker and the legend at 30 columns', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([{ agent: name, cost: null }]), 'root')
  const row = agentRow(lines)

  assert.equal(row, 'abcdefghijkl…: unavailable (!)')
  assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
  assert.ok(lines.includes(LEGEND))
  assert.ok(lines.includes('Summary incomplete'))
})

test('an unattributed unknown total keeps its compact marker and the legend at 30 columns', () => {
  const lines = agentStatsLines(snapshot([{ agent: null, cost: null }]), 'root')
  const row = lines.find((line) => line.startsWith('Unattributed:'))

  assert.equal(row, 'Unattributed: unavailable (!)')
  assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
  assert.ok(lines.includes(LEGEND))
})

test('long named and unattributed unknown rows fit together with one legend', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'abcdefghijklmnop', cost: null },
    { agent: null, cost: null },
  ]), 'root')
  const rows = lines.filter((line) => line.includes(': '))

  assert.equal(rows.length, 2)
  assert.ok(rows.every((row) => row.endsWith(' (!)')))
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
  assert.equal(lines.filter((line) => line === LEGEND).length, 1)
})

test('known incomplete totals keep the full marker without a legend', () => {
  const lines = agentStatsLines(snapshot([
    { agent: 'partial', cost: 2 },
    { agent: 'partial', cost: null },
  ]), 'root')

  assert.ok(lines.includes('partial: $2.00 (incomplete)'))
  assert.ok(!lines.includes(LEGEND))
})

test('named overflow totals keep the full marker within the host width', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([
    { agent: name, cost: 1e308 },
    { agent: name, cost: null },
  ]), 'root')
  const row = agentRow(lines)

  assert.ok(row.includes('>$9999.99'))
  assert.ok(row.endsWith(' (incomplete)'), row)
  assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
})

test('unattributed overflow totals use the compact marker and legend within the host width', () => {
  const lines = agentStatsLines(snapshot([
    { agent: null, cost: -1e308 },
    { agent: null, cost: null },
  ]), 'root')
  const row = lines.find((line) => line.startsWith('Unattributed:'))

  assert.ok(row.includes('<-$9999.99'), row)
  assert.ok(row.endsWith(' (!)'), row)
  assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
  assert.ok(lines.includes(LEGEND))
})

test('colliding unknown names keep distinct labels and fit their compact markers', () => {
  const name = 'abcdefghijklmnop'
  const lines = agentStatsLines(snapshot([
    { agent: name, cost: null },
    { agent: `${name} `, cost: null },
  ]), 'root')
  const rows = lines.filter((line) => line.includes(': '))

  assert.equal(rows.length, 2)
  assert.equal(new Set(rows.map((row) => row.slice(0, row.indexOf(': ')))).size, 2)
  assert.ok(rows.every((row) => row.endsWith(' (!)')), rows.join('\n'))
  assert.ok(rows.every((row) => displayWidth(row) <= HOST_WIDTH), rows.join('\n'))
  assert.ok(lines.includes(LEGEND))
})

test('every generated row preserves its amount and leaves the status marker on one row', () => {
  const cases = [
    { agent: 'a', cost: null },
    { agent: 'abcdefghijklmnop', cost: null },
    { agent: 'abcdefghijklmnop', cost: 2 },
    { agent: 'abcdefghijklmnop', cost: 1e308 },
    { agent: 'abcdefghijklmnop', cost: -1e308 },
    { agent: '代理代理代理代理', cost: null },
    { agent: null, cost: null },
    { agent: null, cost: 3 },
    { agent: null, cost: 1e308 },
  ]

  for (const record of cases) {
    const lines = agentStatsLines(snapshot([record]), 'root')
    const rows = lines.filter((line) => line.includes(': '))
    assert.equal(rows.length, 1, JSON.stringify(record))
    const [row] = rows
    assert.ok(displayWidth(row) <= HOST_WIDTH, `${displayWidth(row)} columns: ${row}`)
    assert.ok(!row.endsWith('unavailable'), `amount and status must both remain: ${row}`)
    if (row.endsWith(' (!)')) assert.ok(lines.includes(LEGEND), row)
  }
})
