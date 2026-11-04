import assert from 'node:assert/strict'
import test from 'node:test'
import {
  modelSidebarRows,
  modelStatsCollapsed,
  modelStatsHistoryState,
  modelStatsLegendCount,
  modelStatsRowsHaveCosts,
  modelStatsRowsMatch,
  modelStatsSectionHasRow,
  modelSummaryNoticeAbsent,
} from '../steps/model_sidebar_helper.js'
import { inspectModelAlignment, inspectModelNameSizing } from '../steps/sidebar_model_alignment_helper.js'

const screen = (...modelLines) => [
  ' unrelated: loading unavailable Summary incomplete',
  '                 ▼ Agent stats',
  '                 alpha:     $1.00e',
  '                 e = estimated',
  '                 ▼ Model stats',
  ...modelLines.map(line => `                 ${line}`),
  '',
  '                 unrelated: $99.00',
].join('\n')

test('Model stats rows are isolated from Agent stats and unrelated sidebar content', () => {
  const text = screen('shared-model:  $3.00e', 'unknown-model: unavailable', 'e = estimated')
  assert.deepEqual(modelSidebarRows(text).map(({ name, value, marker }) => ({ name, value, marker })), [
    { name: 'shared-model', value: '$3.00', marker: 'e' },
    { name: 'unknown-model', value: 'unavailable', marker: 'blank' },
  ])
  assert.equal(modelStatsRowsMatch(text, new Map([
    ['shared-model', '$3.00'],
    ['unknown-model', 'unavailable'],
  ])), true)
  assert.equal(modelStatsLegendCount(text), 1)
  assert.equal(modelStatsRowsMatch(text, new Map([['shared-model', '$3.00']])), false)
})

test('Model stats rows have the expected distinct costs and row count', () => {
  const valid = screen('model-a: $1.00', 'model-b: $2.00')
  assert.equal(modelStatsRowsHaveCosts(valid, new Set(['$1.00', '$2.00'])), true)
  assert.equal(modelStatsRowsHaveCosts(valid, new Set(['$1.00'])), false)

  const duplicateCost = screen('model-a: $1.00', 'model-b: $1.00')
  assert.equal(modelStatsRowsHaveCosts(duplicateCost, new Set(['$1.00', '$2.00'])), false)
})

test('Model stats cost rows reject invalid and collapsed sections', () => {
  const invalid = screen('model-a: $1.00', 'not a model row')
  assert.equal(modelStatsRowsHaveCosts(invalid, new Set(['$1.00'])), false)

  const collapsed = [
    '                 ▼ Agent stats',
    '                 alpha: $1.00',
    '                 ▶ Model stats',
    '                 model-a: $1.00',
  ].join('\n')
  assert.equal(modelStatsRowsHaveCosts(collapsed, new Set(['$1.00'])), false)
})

test('collapsed or absent Model stats cannot match visible rows in another section', () => {
  const collapsed = [
    '                 ▼ Agent stats',
    '                 alpha: $1.00',
    '                 ▶ Model stats',
    '                 model-a: $1.00',
  ].join('\n')
  assert.equal(modelStatsCollapsed(collapsed), true)
  assert.deepEqual(modelSidebarRows(collapsed), [])
  assert.equal(modelStatsRowsMatch(collapsed, new Map([['model-a', 1]])), false)
  assert.deepEqual(modelSidebarRows('model-a: $1.00'), [])
})

test('a collapsed Model stats hide check still detects stale raw row content', () => {
  const stale = [
    '                 ▶ Model stats',
    '                 model-a: $1.00',
  ].join('\n')
  assert.equal(modelStatsCollapsed(stale), true)
  assert.deepEqual(modelSidebarRows(stale), [])
  assert.equal(modelStatsSectionHasRow(stale, 'model-a'), true)
  assert.equal(modelStatsSectionHasRow(stale, 'model-b'), false)
})

test('only a lowercase e marker and one exact legend identify a known incomplete row', () => {
  const valid = screen('partial-model: $2.00e', 'e = estimated')
  const upperMarker = screen('partial-model: $2.00E', 'e = estimated')
  const missingLegend = screen('partial-model: $2.00e')
  const duplicateLegend = screen('partial-model: $2.00e', 'e = estimated', 'e = estimated')

  assert.equal(modelStatsRowsMatch(valid, new Map([['partial-model', '$2.00']])), true)
  assert.equal(modelStatsRowsMatch(upperMarker, new Map([['partial-model', '$2.00']])), false)
  assert.equal(modelStatsRowsMatch(missingLegend, new Map([['partial-model', '$2.00']])), false)
  assert.equal(modelStatsRowsMatch(duplicateLegend, new Map([['partial-model', '$2.00']])), false)
})

test('Model stats history state assertions use only that summary section', () => {
  const empty = screen('No model usage recorded')
  const loading = screen('Loading session history…')
  const unavailable = screen('Session history unavailable')
  assert.equal(modelStatsHistoryState(empty, 'empty'), true)
  assert.equal(modelStatsHistoryState(empty, 'loading'), false)
  assert.equal(modelStatsHistoryState(loading, 'loading'), true)
  assert.equal(modelStatsHistoryState(loading, 'empty'), false)
  assert.equal(modelStatsHistoryState(unavailable, 'unavailable'), true)
  assert.equal(modelStatsHistoryState(unavailable, 'empty'), false)
})

test('Model stats empty history rejects the Agent-only no-usage status as a negative control', () => {
  const agentEmptyStatus = screen('No agent usage recorded')
  assert.equal(modelStatsHistoryState(agentEmptyStatus, 'empty'), false)
  assert.equal(modelStatsRowsMatch(agentEmptyStatus, new Map()), false)
  assert.equal(modelSummaryNoticeAbsent(agentEmptyStatus), false)
})

test('a cost row named Summary incomplete is not mistaken for a standalone notice', () => {
  const asRow = screen('Summary incomplete: $1.00')
  const asNotice = screen('Summary incomplete')
  assert.equal(modelStatsRowsMatch(asRow, new Map([['Summary incomplete', 1]])), true)
  assert.equal(modelSummaryNoticeAbsent(asRow), true)
  assert.equal(modelSummaryNoticeAbsent(asNotice), false)
  assert.equal(modelSummaryNoticeAbsent(asRow.replace('▼ Model stats', '▼ Model stats — Summary incomplete')), false)
})

test('Model stats alignment and row-local label sizing reject misaligned or prematurely shortened rows', () => {
  const aligned = screen('model-one:          $1.20e', 'model-two:          $3.00 ')
  assert.equal(inspectModelAlignment(aligned, [
    { label: 'model-one', value: '$1.20', marker: 'e' },
    { label: 'model-two', value: '$3.00', marker: 'blank' },
  ]), true)

  const short = { identifier: 'compact-model', cost: '$1.00', must_be_full: 'yes' }
  const longA = `${'shared-prefix-'.repeat(3)}alpha`
  const longB = `${'shared-prefix-'.repeat(3)}beta`
  const expected = [
    short,
    { identifier: longA, cost: '$2.00', must_be_full: 'no' },
    { identifier: longB, cost: '$3.00', must_be_full: 'no' },
  ]
  const fit = (name, width) => name.length <= width ? name : `${name.slice(0, width - 1)}…`
  const render = (item, collisionIndex = null) => {
    const valueAt = 37 - item.cost.length - 1
    const nameWidth = valueAt - 2
    const suffix = collisionIndex === null ? '' : ` #${collisionIndex}`
    const label = suffix
      ? `${fit(item.identifier, nameWidth - suffix.length)}${suffix}`
      : fit(item.identifier, nameWidth)
    return `${label}:${' '.repeat(valueAt - label.length - 1)}${item.cost}`
  }
  const sized = screen(
    render(short),
    render(expected[1], 1),
    render(expected[2], 2),
  )
  assert.equal(inspectModelNameSizing(sized, expected), true)
  const premature = screen('compact-…:            $1.00', render(expected[1], 1), render(expected[2], 2))
  assert.equal(inspectModelNameSizing(premature, expected), false)
})

test('Model stats name collisions require deterministic #47-style suffixes, including whitespace-equivalent IDs', () => {
  const valueAt = cost => 37 - cost.length - 1
  const render = (item, label) => `${label}:${' '.repeat(valueAt(item.cost) - label.length - 1)}${item.cost}`
  const renderRows = (items, labels) => screen(...items.map((item, index) => render(item, labels[index])))
  const fit = (name, width) => name.length <= width ? name : `${name.slice(0, width - 1)}…`

  const longPrefix = 'shared-prefix-'.repeat(3)
  const widthCollision = [
    { identifier: `${longPrefix}alpha`, cost: '$2.00', must_be_full: 'no' },
    { identifier: `${longPrefix}beta`, cost: '$3.00', must_be_full: 'no' },
  ]
  const width = valueAt('$2.00') - 2
  const widthLabels = widthCollision.map((item, index) => `${fit(item.identifier, width - 3)} #${index + 1}`)
  assert.equal(inspectModelNameSizing(renderRows(widthCollision, widthLabels), widthCollision), true)
  assert.equal(inspectModelNameSizing(renderRows(widthCollision, [
    `${fit(widthCollision[0].identifier, width - 3)} #x`,
    `${fit(widthCollision[1].identifier, width - 3)} #y`,
  ]), widthCollision), false)
  assert.equal(inspectModelNameSizing(renderRows(widthCollision, [...widthLabels].reverse()), widthCollision), false)

  const whitespaceCollision = [
    { identifier: 'shared model', cost: '$1.00', must_be_full: 'no' },
    { identifier: 'shared\u00a0model', cost: '$2.00', must_be_full: 'no' },
  ]
  assert.equal(
    whitespaceCollision[0].identifier.replace(/\s+/gu, ' '),
    whitespaceCollision[1].identifier.replace(/\s+/gu, ' '),
  )
  const whitespaceLabels = ['shared model #1', 'shared\u00a0model #2']
  assert.equal(inspectModelNameSizing(renderRows(whitespaceCollision, whitespaceLabels), whitespaceCollision), true)
  assert.equal(inspectModelNameSizing(renderRows(whitespaceCollision, whitespaceCollision.map(item => item.identifier)), whitespaceCollision), false)
})
