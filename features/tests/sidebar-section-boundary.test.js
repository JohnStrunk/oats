import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentIncomplete, amountFor, collapsedWithoutContent, displayedValue, historyState, rowsFor,
  rowsRemain, sidebarAgentRows, sidebarRowsMatch, sidebarSectionLines, summaryIncomplete,
} from '../steps/sidebar_section_helper.js'

test('agent rows are restricted to the section, not unrelated sidebar footer text', () => {
  const screen = [
    ' left content                other: $99.00',
    ' left content                ▾ Agent stats',
    ' left content                alpha: $1.00',
    ' left content                beta: $2.00',
    ' left content                Summary incomplete',
    ' left content',
    ' left content                other: $10.00',
    ' left content                alpha: $500.00',
  ].join('\n')
  assert.deepEqual(sidebarSectionLines(screen).map(line => line.trim()), [
    'alpha: $1.00', 'beta: $2.00', 'Summary incomplete',
  ])
  assert.equal(rowsFor(screen, 'alpha').length, 1)
  assert.equal(amountFor(rowsFor(screen, 'alpha')[0]), 1)
  assert.deepEqual(rowsFor(screen, 'other'), [])
})

test('an absent or collapsed section cannot match other screen text', () => {
  assert.deepEqual(rowsFor('alpha: $1.00', 'alpha'), [])
  assert.deepEqual(rowsFor('  ▸ Agent stats\n\n  alpha: $1.00', 'alpha'), [])
})

const screen = (...sectionLines) => [
  ' unrelated: loading unavailable Summary incomplete',
  '                 ▾ Agent stats',
  ...sectionLines.map(line => `                 ${line}`),
  '',
  '                 summary incomplete loading unavailable',
].join('\n')

test('incompleteness must be in the value, not the agent name', () => {
  assert.equal(agentIncomplete(screen('partial:   $2.00 '), 'partial'), false)
  assert.equal(agentIncomplete(screen('unknown:   $1.00 '), 'unknown'), false)
  assert.equal(agentIncomplete(screen('partial:   $2.00e', 'e = incomplete total'), 'partial'), true)
  assert.equal(agentIncomplete(screen('unknown:   unavailable '), 'unknown'), true)
})

test('e markers and unavailable values require clear evidence', () => {
  const legend = 'e = incomplete total'
  assert.equal(agentIncomplete(screen('unknown:   unavailable '), 'unknown'), true)
  assert.equal(agentIncomplete(screen('unknown:   unavailable ', legend), 'unknown'), true)
  assert.equal(agentIncomplete(screen('unknown:   $1.00 '), 'unknown'), false)
  assert.equal(agentIncomplete(screen('unknown:   $1.00e', legend), 'unknown'), true)
  assert.equal(agentIncomplete(screen('tiny:   >$9999.99e', legend), 'tiny'), true)
  assert.equal(agentIncomplete(screen('tiny:   >$9999.99e'), 'tiny'), false)
  assert.equal(agentIncomplete(screen('tiny:   >$9999.99'), 'tiny'), false)
  assert.equal(agentIncomplete(screen('tiny:   >$9999.99e', 'e = incomplete'), 'tiny'), false)
  assert.equal(agentIncomplete(screen('tiny:   >$9999.99e', 'e = Incomplete total'), 'tiny'), false)
  assert.equal(collapsedWithoutContent(' ▶ Agent stats\n tiny:   >$9999.99e\n e = incomplete total\n'), false)
  assert.equal(agentIncomplete('tiny:   >$9999.99e\n e = incomplete total', 'tiny'), false)
})

test('bounded rows and the e legend are included without hiding extra rows', () => {
  const expected = new Map([['tiny', '>$9999.99']])
  const marked = screen('tiny:   >$9999.99e', 'e = incomplete total', 'Summary incomplete')
  assert.deepEqual(sidebarAgentRows(marked).map(row => row.name), ['tiny'])
  assert.equal(sidebarRowsMatch(marked, expected), true)
  assert.equal(sidebarRowsMatch(screen('tiny:   >$9999.99e', 'Summary incomplete'), expected), false)
  assert.equal(sidebarRowsMatch(screen('tiny:   >$9999.99e', 'e = incomplete'), expected), false)
  assert.equal(sidebarRowsMatch(screen('tiny:   >$9999.99e', 'e = incomplete total', 'intruder: <-$9999.99'), expected), false)
  assert.equal(sidebarRowsMatch(screen('tiny:   <-$9999.99', 'Summary incomplete'), expected), false)
  assert.equal(sidebarRowsMatch(screen('tiny:   <-$9999.99', 'Summary incomplete'), new Map([['tiny', '<-$9999.99']])), true)
})

test('summary and history indicators outside the section cannot satisfy assertions', () => {
  const noIndicators = screen('alpha: $1.00')
  assert.equal(summaryIncomplete(noIndicators), false)
  assert.equal(historyState(noIndicators, 'loading'), false)
  assert.equal(historyState(noIndicators, 'unavailable'), false)
  assert.equal(historyState(screen('No agent records available', 'History unavailable or incomplete'), 'empty'), false)
  assert.equal(historyState(screen('No agent records available', 'Summary incomplete'), 'empty'), true)
  assert.equal(summaryIncomplete(screen('alpha:   $1.00e', 'e = incomplete total')), false)
  assert.equal(summaryIncomplete(screen('alpha: $1.00', 'Summary incomplete')), true)
  assert.equal(historyState(screen('Summary unavailable'), 'unavailable'), false)
  assert.equal(historyState(screen('Summary unavailable', 'History ready'), 'unavailable'), false)
  assert.equal(historyState(screen('Summary unavailable; history ready'), 'unavailable'), false)
  assert.equal(historyState(screen('Session history unavailable', 'Summary incomplete'), 'unavailable'), true)
  assert.equal(historyState(screen('Session history was unavailable'), 'unavailable'), true)
  assert.equal(historyState(screen('Failed to load session history'), 'unavailable'), true)
  assert.equal(historyState(screen('Session history', 'unavailable'), 'unavailable'), true)
})

test('loading requires a history-specific indicator, including wrapped text', () => {
  assert.equal(historyState(screen('Summary loading'), 'loading'), false)
  assert.equal(historyState(screen('Summary loading', 'History ready'), 'loading'), false)
  assert.equal(historyState(screen('Summary loading; history ready'), 'loading'), false)
  assert.equal(historyState(screen('Summary loading session history ready'), 'loading'), false)
  assert.equal(historyState(screen('Session history', 'Summary loading'), 'loading'), false)
  assert.equal(historyState(screen('Loading models', 'session history ready'), 'loading'), false)
  assert.equal(historyState(screen('loading: $1.00', 'Summary incomplete'), 'loading'), false)
  assert.equal(historyState(screen('Loading session history…'), 'loading'), true)
  assert.equal(historyState(screen('Loading session', 'history…'), 'loading'), true)
  assert.equal(historyState(screen('Loading', 'session history…'), 'loading'), true)
  assert.equal(historyState(screen('Session history', 'is loading…'), 'loading'), true)
  assert.equal(historyState(screen('Session history is', 'loading…'), 'loading'), true)
  assert.equal(historyState(screen('History is loading'), 'loading'), true)
})

test('exact amounts never match directional bounds or partial dollar substrings', () => {
  assert.equal(displayedValue('tiny:   $1.25'), '$1.25')
  assert.equal(displayedValue('tiny:   $-1.25e'), '$-1.25')
  assert.equal(displayedValue('tiny:   >$1.25'), '>$1.25')
  assert.equal(displayedValue('tiny:   <-$1.25'), '<-$1.25')
  assert.notEqual(displayedValue('tiny:   >$1.25'), '$1.25')
  assert.notEqual(displayedValue('tiny:   >$0.01'), '$0.01')
  assert.equal(displayedValue('tiny:   $1.25junk'), null)
  assert.equal(amountFor('tiny:   >$1.25'), null)
  assert.equal(amountFor('tiny: <-$1.25'), null)
  assert.equal(amountFor('tiny: $1.25'), 1.25)
})

test('extra or duplicate agent rows and stale old-session rows are rejected', () => {
  const expected = new Map([['new-agent', 5]])
  const current = screen('new-agent: $5.00', 'Summary incomplete')
  assert.equal(sidebarRowsMatch(current, expected), true)
  assert.equal(sidebarRowsMatch(screen('new-agent: $5.00', 'intruder: $1.00'), expected), false)
  assert.equal(sidebarRowsMatch(screen('new-agent: $5.00', 'intruder: unavailable'), expected), false)
  assert.equal(sidebarRowsMatch(screen('new-agent: $5.00', 'intruder: free'), expected), false)
  assert.equal(sidebarRowsMatch(screen('new-agent: $5.00', 'intruder 0.00'), expected), false)
  assert.equal(sidebarRowsMatch(screen('new-agent: $5.00', 'new-agent: $5.00'), expected), false)
  assert.equal(sidebarRowsMatch(screen('alpha: $1.00'), expected), false)
})

test('collapsed section assertion rejects any remaining contents', () => {
  assert.equal(collapsedWithoutContent(' ▶ Agent stats\n\n footer'), true)
  assert.equal(collapsedWithoutContent(' ▶ Agent stats\n alpha:   $1.00 \n'), false)
  assert.equal(collapsedWithoutContent(' ▶ Agent stats\n Summary incomplete\n'), false)
  assert.equal(collapsedWithoutContent(' ▼ Agent stats\n\n'), false)
})

test('post-release stability check rejects a stale frame after a correct one', async () => {
  const expected = new Map([['new-agent', 5]])
  const frames = [screen('new-agent: $5.00'), screen('alpha: $1.00')]
  let index = 0
  assert.equal(await rowsRemain(() => frames[Math.min(index++, 1)], expected, { durationMs: 20, pollMs: 1 }), false)
  assert.equal(await rowsRemain(() => frames[0], expected, { durationMs: 5, pollMs: 1 }), true)
})
