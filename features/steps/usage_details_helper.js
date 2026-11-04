import assert from 'node:assert/strict'
import { detailsFixture, message, model, usage } from './usage_details_fixture.js'
import { eventually, screen, startScenario, updateControl } from './sidebar_scenario_helper.js'
import { COLS as TEST_SCREEN_COLUMNS, ROWS as TEST_SCREEN_ROWS } from './sidebar_pty_driver.js'
import { hasDetailsModal, lineWith, locateExactLabel, locateText, markedNumbers, panelFrame, rowNumbers } from './usage_details_screen.js'

export { lineWith, markedNumbers, rowNumbers }

function sendMouseClick(world, column, row) {
  world.sidebarPty.send(`\x1b[<0;${column + 1};${row + 1}M\x1b[<0;${column + 1};${row + 1}m`)
}

export async function startDetails(world) {
  await startScenario(world, 'history', detailsFixture(world.detailsFixtureName))
}

export async function clickDetails(world) {
  const text = await eventually(world, text => text.split('\n').some(line => line.includes('Agent stats (details)')), 'the Agent stats details link must be visible')
  const lines = text.split('\n')
  const y = lines.findIndex(line => line.includes('Agent stats (details)'))
  const x = lines[y].indexOf('(details)')
  sendMouseClick(world, x + 1, y)
}

export async function modal(world) {
  return eventually(world, text => /\bPrice\b/.test(text) && /\bTokens\b/.test(text) && /\bCost\b/.test(text), 'the usage details modal must show its table')
}

export async function assertVisibleModalBorder(world) {
  const text = await modal(world)
  assert.ok(panelFrame(text), `The usage details panel must have a visible border enclosing its table\n${text}`)
}

export async function assertModalTitleAtUpperLeft(world) {
  const text = await modal(world)
  const title = locateText(text, 'Agent cost details')
  assert.ok(title, `The exact title "Agent cost details" must be visible\n${text}`)

  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must have a visible border before its title position is checked\n${text}`)

  const titleEnd = title.column + 'Agent cost details'.length
  const width = frame.right - frame.left
  assert.ok(title.row === frame.top + 1, `The modal title must be on the panel header's first interior row\n${text}`)
  assert.ok(title.column > frame.left && titleEnd <= frame.right,
    `The full modal title must be inside the panel border\n${text}`)
  assert.ok(title.column < frame.left + Math.ceil(width / 3), `The modal title must be at the panel's upper-left\n${text}`)
}

export async function assertEscButtonAtUpperRight(world) {
  const text = await modal(world)
  const button = locateExactLabel(text, 'esc')
  assert.ok(button, `The exact lowercase "esc" button label must be visible\n${text}`)

  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must have a visible border before the esc position is checked\n${text}`)

  const width = frame.right - frame.left
  assert.ok(button.row === frame.top + 1, `The esc button must be on the panel header's first interior row\n${text}`)
  assert.ok(button.column >= frame.left + Math.floor(width * 2 / 3), `The esc button must be at the panel's upper-right\n${text}`)
  assert.ok(button.column + 3 < frame.right, `The esc button must fit inside the panel border\n${text}`)
}

export async function clickEscButton(world) {
  const text = await modal(world)
  const button = locateExactLabel(text, 'esc')
  assert.ok(button, `The exact lowercase "esc" button must be visible before it is clicked\n${text}`)
  sendMouseClick(world, button.column + 1, button.row)
}

function pointOutsideFrame(frame) {
  const row = Math.floor((frame.top + frame.bottom) / 2)
  if (frame.left > 0) return { column: frame.left - 1, row }
  if (frame.right < TEST_SCREEN_COLUMNS - 1) return { column: frame.right + 1, row }
  if (frame.top > 0) return { column: Math.floor((frame.left + frame.right) / 2), row: frame.top - 1 }
  if (frame.bottom < TEST_SCREEN_ROWS - 1) return { column: Math.floor((frame.left + frame.right) / 2), row: frame.bottom + 1 }
  return null
}

export async function clickOutsideModalPanel(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The bordered usage details panel must be visible before clicking outside it\n${text}`)

  const target = pointOutsideFrame(frame)
  assert.ok(target, `No terminal cell is outside the usage details panel\n${text}`)
  assert.ok(target.column >= 0 && target.column < TEST_SCREEN_COLUMNS &&
    target.row >= 0 && target.row < TEST_SCREEN_ROWS,
  `The click target (${target.column}, ${target.row}) must be within the fixed ${TEST_SCREEN_COLUMNS}x${TEST_SCREEN_ROWS} test screen\n${text}`)

  sendMouseClick(world, target.column, target.row)
}

export async function clickImmediatelyAboveModalPanel(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The bordered usage details panel must be visible before clicking above it\n${text}`)

  const target = {
    column: Math.floor((frame.left + frame.right) / 2),
    row: frame.top - 1,
  }
  assert.ok(target.column >= frame.left && target.column <= frame.right,
    `The click target must be horizontally aligned with the bordered panel\n${text}`)
  assert.ok(!(target.column >= frame.left && target.column <= frame.right &&
    target.row >= frame.top && target.row <= frame.bottom),
  `The click target must be outside the bordered panel frame\n${text}`)
  assert.ok(target.column >= 0 && target.column < TEST_SCREEN_COLUMNS &&
    target.row >= 0 && target.row < TEST_SCREEN_ROWS,
  `The click target (${target.column}, ${target.row}) must be within the fixed ${TEST_SCREEN_COLUMNS}x${TEST_SCREEN_ROWS} test screen\n${text}`)

  sendMouseClick(world, target.column, target.row)
}

export async function pressEscape(world) {
  await modal(world)
  world.sidebarPty.send('\x1b')
}

export async function assertModalClosed(world) {
  await eventually(
    world,
    text => !hasDetailsModal(text) && text.includes('Agent stats (details)') && text.includes('Model stats'),
    'the usage details modal must close and leave the underlying sidebar visible',
  )
}

export function assertHeading(text, agent, modelID, amount) {
  const line = text.split('\n').find(value => value.includes(agent) && value.includes(modelID) && value.includes(amount))
  assert.ok(line, `Missing ${agent} - ${modelID} reported ${amount}:\n${text}`)
  assert.ok(line.includes(`${agent} - `), 'heading must use the requested agent - model separator')
  assert.ok(line.includes(`  ${amount}`), 'heading must separate the model and amount with two spaces')
}

export async function refreshPair(world, cents) {
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = cents.map((value, index) => message(`generated-${index}`, 'alpha', model, value / 100))
    fixture.messages.ses_oats_child = []
    fixture.events.push({ id: `generated-refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
}

export async function refreshInput(world, input) {
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = [message('generated-input', 'alpha', model, 1, { ...usage, input })]
    fixture.messages.ses_oats_child = []
    fixture.events.push({ id: `input-refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
}

export { eventually, screen, updateControl, message, model, usage }
