import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import { agentStatsLines } from '../../src/agent-stats.js'
import {
  MAX_HOST_CONTENT_WIDTH,
  INCOMPLETE_LEGEND,
  costRows,
  displayWidth,
  legendCount,
  rowFor,
  rowsShareValueEnd,
} from './agent-stats-display-oracle.js'

const snapshot = (records, overrides = {}) => ({
  sessionID: 'root',
  records,
  complete: records.every((record) => record.cost != null),
  errors: [],
  gaps: [],
  ...overrides,
})

const records = (entries) =>
  entries.map(([agent, cost], index) => ({ id: `record-${index}`, agent, cost }))

const expectedRow = ({ label, value, marker }) => ({ label, value, marker })

test('mixed complete, incomplete, unknown, bounded and unattributed rows align', () => {
  const lines = agentStatsLines(snapshot(records([
    ['alpha', 0],
    ['beta', 1.2],
    ['beta', null],
    ['gamma', null],
    ['delta', -10_000],
    [null, 3],
    [null, null],
  ])), 'root')
  const rows = costRows(lines)

  assert.deepEqual(rows.map(expectedRow), [
    { label: 'alpha', value: '$0.00', marker: 'blank' },
    { label: 'beta', value: '$1.20', marker: 'e' },
    { label: 'gamma', value: 'unavailable', marker: 'blank' },
    { label: 'delta', value: '<-$9999.99', marker: 'blank' },
    { label: 'Unattributed', value: '$3.00', marker: 'e' },
  ])
  assert.ok(rows.every((row) => row.labelAt === 0), 'labels must start at the left edge')
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.markerSlot === (row.marker === 'e' ? 'e' : ' ')))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.map((row) => row.width).join(', '))
  assert.equal(legendCount(lines), 1)
  assert.ok(lines.includes('Summary incomplete'))
})

test('an unknown total remains unavailable rather than zero, with no e or legend', () => {
  const lines = agentStatsLines(snapshot(records([
    ['known-zero', 0],
    ['unknown', null],
    [null, null],
  ])), 'root')
  const unknown = rowFor(lines, 'unknown')
  const bucket = rowFor(lines, 'Unattributed')

  assert.equal(rowFor(lines, 'known-zero').value, '$0.00')
  assert.equal(unknown.value, 'unavailable')
  assert.equal(unknown.marker, 'blank')
  assert.equal(unknown.markerSlot, ' ')
  assert.equal(bucket.value, 'unavailable')
  assert.equal(bucket.marker, 'blank')
  assert.equal(bucket.markerSlot, ' ')
  assert.ok(!costRows(lines).some((row) => row.value === '$0.00' && row.label !== 'known-zero'))
  assert.equal(legendCount(lines), 0, 'unknown totals do not add an e legend')
  assert.ok(lines.includes('Summary incomplete'))
})

test('complete and incomplete zero totals share the value column but differ in marker', () => {
  const lines = agentStatsLines(snapshot(records([
    ['complete-zero', 0],
    ['incomplete-zero', 0],
    ['incomplete-zero', null],
  ])), 'root')
  const complete = rowFor(lines, 'complete-zero')
  const incomplete = rowFor(lines, 'incomplete-zero')

  assert.equal(complete.value, '$0.00')
  assert.equal(complete.marker, 'blank')
  assert.equal(complete.markerSlot, ' ')
  assert.equal(incomplete.value, '$0.00')
  assert.equal(incomplete.marker, 'e')
  assert.equal(incomplete.markerSlot, 'e')
  assert.equal(complete.valueEnd, incomplete.valueEnd)
  assert.equal(legendCount(lines), 1)
})

test('directional bounds keep their marker immediately after the value', () => {
  const lines = agentStatsLines(snapshot(records([
    ['over-complete', 1e308],
    ['over-incomplete', 1e308],
    ['over-incomplete', null],
    ['under-complete', -1e308],
    ['under-incomplete', -1e308],
    ['under-incomplete', null],
  ])), 'root')
  const rows = costRows(lines)

  assert.deepEqual(rows.map(expectedRow), [
    { label: 'over-complete', value: '>$9999.99', marker: 'blank' },
    { label: 'over-incomplete', value: '>$9999.99', marker: 'e' },
    { label: 'under-complete', value: '<-$9999.99', marker: 'blank' },
    { label: 'under-incomplete', value: '<-$9999.99', marker: 'e' },
  ])
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.markerSlot === (row.marker === 'e' ? 'e' : ' ')))
  assert.equal(legendCount(lines), 1)
})

test('wide and truncated labels keep left alignment and the shared value column', () => {
  const lines = agentStatsLines(snapshot(records([
    ['代理代理代理代理代理', 3],
    [`a${'\u{1B000}'.repeat(20)}`, null],
    ['😀'.repeat(10), 1],
    ['😀'.repeat(10), null],
    ['plain', 0],
  ])), 'root')
  const rows = costRows(lines)

  assert.deepEqual(rows.map(expectedRow), [
    { label: '代理代理代理代…', value: '$3.00', marker: 'blank' },
    { label: `a${'\u{1B000}'.repeat(7)}…`, value: 'unavailable', marker: 'blank' },
    { label: '😀😀😀😀😀😀😀…', value: '$1.00', marker: 'e' },
    { label: 'plain', value: '$0.00', marker: 'blank' },
  ])
  assert.ok(rows.every((row) => row.labelAt === 0))
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.width <= MAX_HOST_CONTENT_WIDTH), rows.map((row) => row.width).join(', '))
  assert.equal(legendCount(lines), 1)
})

test('sanitized colliding labels remain unique, inert and right aligned', () => {
  const lines = agentStatsLines(snapshot(records([
    ['a\u200Bb', 1],
    ['a�b', 1e308],
    ['a�b', null],
    ['a�b #1', 2],
    ['Unattributed', 4],
    [null, 3],
  ])), 'root')
  const rows = costRows(lines)
  const labels = rows.map((row) => row.label)

  assert.equal(new Set(labels).size, labels.length, labels.join(', '))
  assert.ok(rows.every((row) => row.labelAt === 0))
  assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
  assert.ok(rows.every((row) => row.markerSlot === (row.marker === 'e' ? 'e' : ' ')))
  assert.ok(rows.every((row) => !/[\p{Cc}\p{Cf}\p{M}]/u.test(row.label)))
  assert.equal(rowFor(lines, 'Unattributed').value, '$3.00')
  assert.ok(rows.some((row) => row.label.startsWith('Unattributed') && row.label !== 'Unattributed'))
  assert.equal(legendCount(lines), 1)
})

test('the e legend appears exactly once only when an e marker is visible', () => {
  const complete = agentStatsLines(snapshot(records([['alpha', 1], ['beta', 0]])), 'root')
  const unknown = agentStatsLines(snapshot(records([['alpha', null], [null, null]])), 'root')
  const gapOnly = agentStatsLines(snapshot(records([['alpha', 1]]), {
    complete: false,
    gaps: [{ kind: 'historical-usage-unavailable' }],
  }), 'root')
  const mixed = agentStatsLines(snapshot(records([
    ['alpha', 1],
    ['alpha', null],
    ['beta', 2],
    ['beta', null],
    ['gamma', null],
  ])), 'root')

  assert.equal(legendCount(complete), 0)
  assert.equal(legendCount(unknown), 0)
  assert.equal(legendCount(gapOnly), 0)
  assert.equal(legendCount(mixed), 1)
  assert.ok(mixed.filter((line) => line === INCOMPLETE_LEGEND).length === 1)
  assert.ok(mixed.includes('Summary incomplete'))
})

test('generated rows always share a value end and put the marker in the next cell', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -999_999, max: 999_999 }),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (cents, incomplete, unavailable, unknownUnattributed) => {
        const subject = unavailable ? null : cents / 100
        const entries = [['subject', subject]]
        if (incomplete && !unavailable) entries.push(['subject', null])
        entries.push(['zero', 0], [null, unknownUnattributed ? null : 12.34])

        const lines = agentStatsLines(snapshot(records(entries)), 'root')
        const rows = costRows(lines)
        const expectedMarker = incomplete && !unavailable ? 'e' : 'blank'

        assert.equal(rows.length, 3, lines.join('\n'))
        assert.ok(rows.every((row) => row.labelAt === 0))
        assert.ok(rowsShareValueEnd(rows), rows.map((row) => row.valueEnd).join(', '))
        assert.ok(rows.every((row) => row.markerSlot === (row.marker === 'e' ? 'e' : ' ')))
        assert.equal(rowFor(lines, 'subject').marker, expectedMarker)
        assert.equal(rowFor(lines, 'zero').marker, 'blank')
        assert.equal(rowFor(lines, 'Unattributed').marker, 'blank')
        if (unavailable) assert.equal(rowFor(lines, 'subject').value, 'unavailable')
        if (unknownUnattributed) assert.equal(rowFor(lines, 'Unattributed').value, 'unavailable')
        assert.equal(legendCount(lines), expectedMarker === 'e' ? 1 : 0)
      },
    ),
    { numRuns: 200 },
  )
})

test('every row stays within the researched host content edge', () => {
  const names = [
    'plain',
    'abcdefghijklmnop',
    '代理代理代理代理代理',
    `a${'\u{1B000}'.repeat(20)}`,
    '😀'.repeat(10),
  ]
  for (const agent of names) {
    for (const entries of [
      [[agent, 1]],
      [[agent, 1], [agent, null]],
      [[agent, null]],
      [[agent, 1e308], [agent, null]],
      [[agent, -1e308], [agent, null]],
    ]) {
      const lines = agentStatsLines(snapshot(records(entries)), 'root')
      const rows = costRows(lines)
      assert.equal(rows.length, 1, JSON.stringify(entries))
      assert.ok(displayWidth(rows[0].line) <= MAX_HOST_CONTENT_WIDTH,
        `${displayWidth(rows[0].line)} columns: ${rows[0].line}`)
    }
  }
})
