import assert from 'node:assert/strict'
import test from 'node:test'
import { displayWidth } from '../real-host-tests/terminal_screen.js'
import { hasDetailsModal, lineWith, escapeRegExp, locateExactLabel, locateText, markedNumbers, panelFrame, pinnedUsagePanelFrame, rowNumbers, terminalCells } from '../steps/usage_details_screen.js'

const INNER_WIDTH = 48
const border = `┌${'─'.repeat(INNER_WIDTH)}┐`
const bottom = `└${'─'.repeat(INNER_WIDTH)}┘`
const row = content => `│${content}${' '.repeat(Math.max(0, INNER_WIDTH - displayWidth(content)))}│`

const tableRows = [
  'Agent cost details                    esc',
  'alpha - fixture-provider/fixture-model  $3.00',
  '        input       output      cache write',
  'Price   $5.00       $2.00       $6.00',
  'Tokens  800,000     1,000,000   500,000',
  'Cost    $4.00e      $2.00e      $3.00e',
]

function screenWithFrame(rows = tableRows) {
  return ['sidebar above', border, ...rows.map(row), bottom, 'sidebar below'].join('\n')
}

test('panelFrame locates the bordered usage details table', () => {
  const frame = panelFrame(screenWithFrame())
  assert.ok(frame)
  assert.deepEqual(
    { top: frame.top, bottom: frame.bottom, left: frame.left, right: frame.right },
    { top: 1, bottom: 8, left: 0, right: INNER_WIDTH + 1 },
  )
})

test('panelFrame locates the bordered table when a body row contains a wide glyph', () => {
  const rows = [...tableRows]
  rows[1] = 'worker - 代-model  $1.00'
  assert.ok(panelFrame(screenWithFrame(rows)))
})

test('panelFrame rejects a frame with a missing side', () => {
  const lines = screenWithFrame().split('\n')
  const priceRow = lines.findIndex(line => line.includes('Price'))
  lines[priceRow] = ' ' + lines[priceRow].slice(1)
  assert.equal(panelFrame(lines.join('\n')), null)
})

test('panelFrame rejects a frame with a broken horizontal border', () => {
  const lines = screenWithFrame().split('\n')
  lines[1] = `┌${' '.repeat(INNER_WIDTH)}┐`
  assert.equal(panelFrame(lines.join('\n')), null)
})

test('panelFrame requires the details table inside the border', () => {
  const rows = tableRows.map(content => content.replace(/\b(Price|Tokens|Cost)\b/g, 'Value'))
  assert.equal(panelFrame(screenWithFrame(rows)), null)
})

// The `@opencode/cli` 2.1.4 pinned by
// `.github/tooling/opencode-host/package.json` renders `size: 'large'` dialogs
// 88 columns wide inside the 160x40 smoke PTY, and the usage panel fixes its
// bordered surface at 30 rows.
const PINNED_PANEL_WIDTH = 88
const PINNED_PANEL_HEIGHT = 30
const PINNED_PANEL_LEFT = 36
const PINNED_PANEL_TOP = 6
const PINNED_PANEL_RIGHT = PINNED_PANEL_LEFT + PINNED_PANEL_WIDTH - 1
const PINNED_PANEL_BOTTOM = PINNED_PANEL_TOP + PINNED_PANEL_HEIGHT - 1

function blankPinnedPanelScreen() {
  const lines = Array.from({ length: 40 }, () => ' '.repeat(160))
  const horizontal = '─'.repeat(PINNED_PANEL_WIDTH - 2)
  const inner = ' '.repeat(PINNED_PANEL_WIDTH - 2)
  const at = row => ' '.repeat(PINNED_PANEL_LEFT) + row
  lines[PINNED_PANEL_TOP] = at(`┌${horizontal}┐`)
  for (let row = PINNED_PANEL_TOP + 1; row < PINNED_PANEL_BOTTOM; row++) lines[row] = at(`│${inner}│`)
  lines[PINNED_PANEL_BOTTOM] = at(`└${horizontal}┘`)
  return lines.join('\n')
}

test('a blank bordered large panel still counts as an open modal', () => {
  const screen = blankPinnedPanelScreen()
  const frame = pinnedUsagePanelFrame(screen)
  assert.ok(frame)
  assert.deepEqual(
    { top: frame.top, bottom: frame.bottom, left: frame.left, right: frame.right },
    { top: PINNED_PANEL_TOP, bottom: PINNED_PANEL_BOTTOM, left: PINNED_PANEL_LEFT, right: PINNED_PANEL_RIGHT },
  )
  assert.equal(hasDetailsModal(screen), true)
})

test('a closed screen without the bordered panel is not an open modal', () => {
  const screen = ['Agent stats (details)', 'Model stats'].join('\n')
  assert.equal(pinnedUsagePanelFrame(screen), null)
  assert.equal(hasDetailsModal(screen), false)
})

test('a blank border of another size does not count as the pinned panel', () => {
  assert.equal(pinnedUsagePanelFrame(screenWithFrame([])), null)
})

test('lineWith selects the Cost row rather than the title containing "cost"', () => {
  const screen = screenWithFrame()
  assert.match(lineWith(screen, 'Cost'), /^│Cost\s+\$4\.00e/)
  assert.doesNotMatch(lineWith(screen, 'Cost'), /Agent cost details/)
})

test('lineWith treats regexp metacharacters in the label literally', () => {
  assert.equal(lineWith(screenWithFrame(), 'C.st'), '')
  assert.equal(lineWith('│Cost (estimated) $1.00', 'Cost ('), '│Cost (estimated) $1.00')
})

test('escapeRegExp makes regexp metacharacters literal', () => {
  const label = 'C.st ($x) [y]'
  assert.equal(new RegExp(`^${escapeRegExp(label)}$`).test(label), true)
  assert.equal(new RegExp(`^${escapeRegExp(label)}$`).test('Cost ($x) [y]'), false)
})

test('rowNumbers treats regexp metacharacters in the label literally', () => {
  const screen = ['│Cost (estimated)  $1.00e  $2.00e', '│C.st             $9.00'].join('\n')
  assert.deepEqual(rowNumbers(screen, 'Cost ('), [1, 2])
  assert.deepEqual(rowNumbers(screen, 'C.st'), [9])
})

test('markedNumbers treats regexp metacharacters in the label literally', () => {
  const screen = ['│Cost (estimated)  $1.00e  $2.00e', '│C.st             $9.00'].join('\n')
  assert.equal(markedNumbers(screen, 'Cost ('), 2)
  assert.equal(markedNumbers(screen, 'C.st'), 0)
})

test('locateText returns the first literal row and column', () => {
  const text = ['header', '  Agent cost details  ', 'Agent cost details'].join('\n')
  assert.deepEqual(locateText(text, 'Agent cost details'), { row: 1, column: 2 })
  assert.equal(locateText(text, 'missing'), null)
})

test('locateExactLabel returns coordinates at word and case boundaries', () => {
  const text = ['Agent cost details      esc', 'pressed escape', 'ESC here', '[esc]'].join('\n')
  assert.deepEqual(locateExactLabel(text, 'esc'), { row: 0, column: 24 })
  assert.equal(locateExactLabel('pressed escape', 'esc'), null)
  assert.equal(locateExactLabel('ESC here', 'esc'), null)
  assert.equal(locateExactLabel('esc_button', 'esc'), null)
  assert.deepEqual(locateExactLabel('[esc]', 'esc'), { row: 0, column: 1 })
  assert.deepEqual(locateExactLabel('value (esc) here', '(esc)'), { row: 0, column: 6 })
})

test('terminalCells measures wide Unicode headings in terminal columns', () => {
  assert.deepEqual(terminalCells('Aé代B'), ['A', 'é', '代', '', 'B'])
})
