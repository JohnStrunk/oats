import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { detailsFixture, message, model, modelInfo, usage } from './usage_details_fixture.js'
import { eventually, screen, startScenario, updateControl } from './sidebar_scenario_helper.js'
import { COLS as TEST_SCREEN_COLUMNS, ROWS as TEST_SCREEN_ROWS } from './sidebar_pty_driver.js'
import { displayWidth } from '../real-host-tests/terminal_screen.js'
import { hasDetailsModal, lineWith, locateExactLabel, locateText, markedNumbers, panelFrame, rowNumbers, terminalCells } from './usage_details_screen.js'

export { lineWith, markedNumbers, rowNumbers }

function reportedCostMatch(content) {
  return [...content.matchAll(/(?:<-\$[\d,]+(?:\.\d+)?|>\$[\d,]+(?:\.\d+)?|-\$[\d,]+(?:\.\d+)?|\$-?[\d,]+(?:\.\d+)?|unknown|unavailable)e?\b/giu)].at(-1) ?? null
}

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
  assert.ok(title.row === frame.top + 2, `The modal title must follow one vertical padding row inside the panel\n${text}`)
  assert.ok(title.column > frame.left && titleEnd <= frame.right,
    `The full modal title must be inside the panel border\n${text}`)
  assert.equal(displayWidth(text.split('\n')[title.row].slice(0, title.column)), frame.left + 3,
    `The modal title must start two horizontal padding cells inside the left panel border\n${text}`)
  assert.ok(title.column < frame.left + Math.ceil(width / 3), `The modal title must be at the panel's upper-left\n${text}`)
}

export async function assertModalPadding(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details modal must have a bordered panel before padding is checked\n${text}`)

  const title = locateText(text, 'Agent cost details')
  assert.ok(title, `The modal title must be visible before padding is checked\n${text}`)
  assert.equal(title.row, frame.top + 2, `One vertical terminal row must separate the title from the top border\n${text}`)
  const titleColumn = displayWidth(text.split('\n')[title.row].slice(0, title.column))
  assert.equal(titleColumn, frame.left + 3, `Two horizontal terminal cells must precede the title\n${text}`)

  const pairIdentity = `alpha - ${model.providerID}/${model.id}`
  const lines = text.split('\n')
  const headingRow = lines.findIndex(line => line.includes(pairIdentity))
  assert.ok(headingRow >= 0, `The expected pair heading must be visible\n${text}`)
  assert.equal(displayWidth(lines[headingRow].slice(0, lines[headingRow].indexOf(pairIdentity))), frame.left + 3,
    `Two horizontal terminal cells must precede pair content\n${text}`)

  const priceRow = lineWith(text, 'Price')
  const priceRowIndex = lines.indexOf(priceRow)
  assert.ok(priceRowIndex >= 0, `The table's first row label must be visible before its left padding is checked\n${text}`)
  assert.equal(displayWidth(priceRow.slice(0, priceRow.indexOf('Price'))), frame.left + 3,
    `Two horizontal terminal cells must precede table content\n${text}`)

  const closeButton = locateExactLabel(text, 'esc')
  assert.ok(closeButton, `The modal close button must be visible before right padding is checked\n${text}`)
  const closeButtonColumn = displayWidth(lines[closeButton.row].slice(0, closeButton.column))
  assert.equal(closeButtonColumn + 2, frame.right - 3,
    `Two horizontal terminal cells must follow the close button before the right border\n${text}`)
}

export async function assertModalBottomPadding(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details modal must have a bordered panel before bottom padding is checked\n${text}`)
  const lines = text.split('\n')
  const bottomPadding = terminalCells(lines[frame.bottom - 1])
  // The scrollbar is a separate edge control at the panel's rightmost interior
  // cell; it is not part of the details content whose bottom padding is checked.
  const contentCells = bottomPadding.slice(frame.left + 1, frame.right - 1)
  assert.ok(contentCells.every(cell => cell === ' '),
    `One blank terminal row must remain between the scrolled details content and the bottom border\n${text}`)
}

function terminalPosition(line, row, value) {
  const index = line.indexOf(value)
  assert.ok(index >= 0, `Missing rendered text "${value}" in row ${row}: ${line}`)
  return { row, column: displayWidth(line.slice(0, index)) }
}

function textStyle(world, text, value, row = undefined, column = undefined) {
  assert.equal(world.sidebarPty.screen(), text,
    'Text and SGR attributes must be read from the same rendered PTY screen')
  const lines = text.split('\n')
  const rowIndex = row ?? lines.findIndex(line => line.includes(value))
  assert.ok(rowIndex >= 0, `Missing text "${value}" before its terminal style can be checked\n${text}`)
  const position = column === undefined
    ? terminalPosition(lines[rowIndex], rowIndex, value)
    : { row: rowIndex, column }
  if (column !== undefined) {
    const visible = terminalCells(lines[rowIndex]).slice(column, column + displayWidth(value)).join('')
    assert.equal(visible, value, `Text "${value}" must occupy its selected panel cells\n${text}`)
  }
  let offset = 0
  let firstStyle = null
  for (const char of value) {
    const style = world.sidebarPty.styleAt(position.row, position.column + offset)
    if (firstStyle === null) firstStyle = style
    else assert.deepEqual(style, firstStyle, `The rendered text "${value}" must use a consistent SGR style\n${text}`)
    offset += displayWidth(char)
  }
  assert.equal(world.sidebarPty.screen(), text,
    'The PTY screen must remain stable while its rendered SGR style is read')
  return { position, style: firstStyle }
}

function panelContent(line, frame) {
  return terminalCells(line).slice(frame.left + 1, frame.right).join('')
}

function panelRows(frame) {
  return frame.lines.slice(frame.top + 1, frame.bottom).map((line, index) => {
    const row = frame.top + 1 + index
    return { line, row, content: panelContent(line, frame) }
  })
}

function panelColumn(frame, content, index) {
  return frame.left + 1 + displayWidth(content.slice(0, index))
}

function colorStyle(style) {
  return { foreground: style.foreground, background: style.background }
}

async function assertNightOwlThemeTokens(world) {
  if (world.sidebarTheme !== 'nightowl') return

  let serializedTheme
  try {
    serializedTheme = await readFile(`${world.sidebarControl}.theme`, 'utf8')
  } catch (error) {
    assert.fail(`The synthetic host adapter must capture resolved Night Owl theme tokens: ${error.message}`)
  }
  const raised = JSON.parse(serializedTheme).background?.raised
  const isColorTuple = value => Array.isArray(value) && value.length === 4 &&
    value.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)
  assert.ok(isColorTuple(raised?.base) && isColorTuple(raised?.high) && isColorTuple(raised?.max),
    `The synthetic host adapter must report resolved raised base/high/max tokens via toInts(); captured ${JSON.stringify(raised)}`)
  assert.deepEqual(raised.high, raised.base,
    'Pinned OpenCode v2.1.4 Night Owl must resolve raised.high to the same color as raised.base')
  assert.notDeepEqual(raised.max, raised.base,
    'Pinned OpenCode v2.1.4 Night Owl must resolve raised.max to a color distinct from raised.base')
}

async function modalForColorAssertion(world) {
  const text = await modal(world)
  await assertNightOwlThemeTokens(world)
  return text
}

function assertColorStylesDistinct(styledStyle, normalStyle, styledText, normalDataCell, text) {
  // Deliberately ignore bold and every other non-color SGR attribute: only
  // foreground/background colors from the rendered PTY cells satisfy this
  // assertion.
  const styledColor = colorStyle(styledStyle)
  const normalColor = colorStyle(normalStyle)
  assert.notDeepEqual(styledColor, normalColor,
    `The rendered SGR foreground or background color of "${styledText}" must differ from ordinary numeric data "${normalDataCell.value}"; actual color attributes were ${JSON.stringify(styledColor)} and ${JSON.stringify(normalColor)}\n${text}`)
  return { styledColor, normalColor }
}

function assertColorDistinctAgainstData(world, text, styledText, normalDataCell, row = undefined, column = undefined) {
  const styled = textStyle(world, text, styledText, row, column)
  const normal = textStyle(world, text, normalDataCell.value, normalDataCell.row, normalDataCell.column)
  return assertColorStylesDistinct(styled.style, normal.style, styledText, normalDataCell, text)
}

// Locate every pair-heading element (agent/model identity and reported cost,
// including an unavailable cost) rendered inside the details panel.
function pairHeadingLocations(frame, text) {
  const locations = []
  const pairRows = panelRows(frame).filter(({ content }) => content.includes(' - '))
  assert.ok(pairRows.length > 0, `At least one pair heading inside the usage details panel must be visible before its style is checked\n${text}`)
  for (const { content, row } of pairRows) {
    const costMatch = reportedCostMatch(content)
    assert.ok(costMatch, `Each pair heading inside the usage details panel must show a currency, unknown, or unavailable reported cost\n${text}`)
    const rawIdentity = content.slice(0, costMatch.index)
    const identity = rawIdentity.trim()
    assert.ok(identity.includes(' - '),
      `Each pair heading must show its agent/model identity before its reported cost\n${text}`)
    const identityStart = rawIdentity.indexOf(identity)
    locations.push({ value: identity, row, column: panelColumn(frame, content, identityStart) })
    locations.push({ value: costMatch[0], row, column: panelColumn(frame, content, costMatch.index) })
  }
  return locations
}

// Locate every table-heading element: the four column headings and the
// Price/Tokens/Cost row labels rendered inside the details panel.
function tableHeadingLocations(frame, text) {
  const locations = []
  const columnLabels = ['input', 'output', 'cache write', 'cache read']
  const columnHeader = panelRows(frame).find(({ content }) => /input\s+output\s+cache write\s+cache read/i.test(content))
  assert.ok(columnHeader, `The table's column-heading row must be visible inside the panel before its styles are checked\n${text}`)
  for (const label of columnLabels) {
    const index = columnHeader.content.indexOf(label)
    assert.ok(index >= 0, `The column heading "${label}" must be inside the heading row\n${text}`)
    locations.push({ value: label, row: columnHeader.row, column: panelColumn(frame, columnHeader.content, index) })
  }
  for (const label of ['Price', 'Tokens', 'Cost']) {
    const row = panelRows(frame).find(({ content }) => new RegExp(`^\\s*${label}\\b`, 'i').test(content))
    assert.ok(row, `The table's ${label} row label must be visible inside the panel\n${text}`)
    const labelStart = row.content.indexOf(label)
    assert.ok(labelStart >= 0, `The table's ${label} row label must be inside its row\n${text}`)
    locations.push({ value: label, row: row.row, column: panelColumn(frame, row.content, labelStart) })
  }
  return locations
}

// Read the rendered PTY foreground/background colors of a located element,
// deliberately ignoring bold and every other non-color SGR attribute.
function renderedColorStyle(world, text, location) {
  return colorStyle(textStyle(world, text, location.value, location.row, location.column).style)
}

function firstNumericDataCell(text) {
  const frame = panelFrame(text)
  assert.ok(frame, `The bordered usage details panel must be visible before normal numeric data is selected\n${text}`)
  for (const entry of panelRows(frame)) {
    const label = /^\s*Tokens\b/i.exec(entry.content)
    if (!label) continue
    const match = /\d[\d,]*(?:\.\d+)?/.exec(entry.content.slice(label[0].length))
    if (!match) continue
    const index = label[0].length + match.index
    return {
      value: match[0],
      row: entry.row,
      column: panelColumn(frame, entry.content, index),
    }
  }
  assert.fail(`A numeric Token cell inside the usage details panel must be visible as the normal-data style control\n${text}`)
}

export async function assertModalTitleColorDistinct(world) {
  const text = await modalForColorAssertion(world)
  assertColorDistinctAgainstData(world, text, 'Agent cost details', firstNumericDataCell(text))
}

export async function assertPairHeadingsColorDistinct(world) {
  const text = await modalForColorAssertion(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must be visible before pair heading colors are checked\n${text}`)
  const normalCell = firstNumericDataCell(text)
  for (const { value, row, column } of pairHeadingLocations(frame, text)) {
    assertColorDistinctAgainstData(world, text, value, normalCell, row, column)
  }
}

export async function assertUnavailableReportedCostHeading(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must be visible before its unavailable-cost heading is checked\n${text}`)
  const identity = `beta - ${model.providerID}/${model.id}`
  const heading = panelRows(frame).find(({ content }) => content.includes(identity))
  assert.ok(heading, `The ${identity} pair heading must be visible inside the panel\n${text}`)
  const reportedCost = heading.content.slice(heading.content.indexOf(identity) + identity.length)
  assert.match(reportedCost, /\b(?:unknown|unavailable)e?\b/iu,
    `The ${identity} pair heading must show an unknown or unavailable reported cost\n${text}`)
}

export async function assertTableHeadingColorsDistinct(world) {
  const text = await modalForColorAssertion(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must be visible before table heading colors are checked\n${text}`)
  const normalCell = firstNumericDataCell(text)
  for (const { value, row, column } of tableHeadingLocations(frame, text)) {
    assertColorDistinctAgainstData(world, text, value, normalCell, row, column)
  }
}

// The modal title, the pair titles, and the table headings are three element
// classes; this asserts their rendered PTY foreground/background colors are
// pairwise distinct, so no two classes collapse onto the same color treatment.
export async function assertModalElementsPairwiseColorDistinct(world) {
  const text = await modalForColorAssertion(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must be visible before its title, pair titles, and table headings are compared\n${text}`)

  const titleColor = colorStyle(textStyle(world, text, 'Agent cost details').style)
  const pairColors = pairHeadingLocations(frame, text).map(location => renderedColorStyle(world, text, location))
  const tableColors = tableHeadingLocations(frame, text).map(location => renderedColorStyle(world, text, location))

  const describe = color => JSON.stringify(color)
  for (const pairColor of pairColors) {
    for (const tableColor of tableColors) {
      assert.notDeepEqual(pairColor, tableColor,
        `The rendered SGR foreground or background colors of a usage details pair title (${describe(pairColor)}) and a table heading (${describe(tableColor)}) must be pairwise distinct\n${text}`)
    }
  }
  for (const pairColor of pairColors) {
    assert.notDeepEqual(titleColor, pairColor,
      `The rendered SGR foreground or background colors of the usage details modal title (${describe(titleColor)}) and a pair title (${describe(pairColor)}) must be pairwise distinct\n${text}`)
  }
  for (const tableColor of tableColors) {
    assert.notDeepEqual(titleColor, tableColor,
      `The rendered SGR foreground or background colors of the usage details modal title (${describe(titleColor)}) and a table heading (${describe(tableColor)}) must be pairwise distinct\n${text}`)
  }
}

export async function assertPairHeadingAlignment(world) {
  const text = await modal(world)
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details modal must have a bordered panel before heading alignment is checked\n${text}`)
  const headingRows = panelRows(frame).filter(({ content }) => content.includes(' - '))
  assert.ok(headingRows.length > 0, `At least one pair heading inside the usage details modal must be visible\n${text}`)

  for (const { content, row } of headingRows) {
    const costMatch = reportedCostMatch(content)
    assert.ok(costMatch, `Each pair heading inside the usage details modal must show its reported cost\n${text}`)
    const rawIdentity = content.slice(0, costMatch.index)
    const identity = rawIdentity.trim()
    assert.ok(identity.includes(' - '), `Each pair heading inside the usage details modal must show its agent/model identity before its reported cost\n${text}`)
    const identityStart = rawIdentity.indexOf(identity)
    const identityColumn = panelColumn(frame, content, identityStart)
    const costStart = panelColumn(frame, content, costMatch.index)
    const costEnd = costStart + displayWidth(costMatch[0]) - 1
    assert.equal(identityColumn, frame.left + 3,
      `Pair agent/model identity on row ${row} must be left-justified at the padded panel edge\n${text}`)
    assert.equal(costEnd, frame.right - 3,
      `Pair reported cost on row ${row} must be right-justified at the padded panel edge\n${text}`)
    assert.ok(identityColumn < costStart, `Pair identity must precede its right-justified reported cost\n${text}`)
  }
}

export function assertOverlongPairHeading(text, { identityPrefix, fullIdentity, reportedCost }) {
  const frame = panelFrame(text)
  assert.ok(frame, `The usage details modal must have a bordered panel before overflow alignment is checked\n${text}`)
  const frameTop = frame.lines[frame.top]
  const frameLeftColumn = displayWidth(frameTop.slice(0, frame.left))
  const frameRightColumn = displayWidth(frameTop.slice(0, frame.right))

  const headingRows = text.split('\n').map((line, row) => ({ line, row }))
    .filter(({ line }) => {
      const identityStart = line.indexOf(identityPrefix)
      const costStart = line.indexOf(reportedCost)
      return identityStart >= 0 && costStart > identityStart &&
        displayWidth(line.slice(0, identityStart)) === frameLeftColumn + 3
    })
  assert.equal(headingRows.length, 1,
    `The identity and complete reported cost must appear together on exactly one heading row\n${text}`)

  const { line, row } = headingRows[0]
  const identityStart = line.indexOf(identityPrefix)
  const costStartIndex = line.indexOf(reportedCost)
  const visibleIdentity = line.slice(identityStart, costStartIndex).replace(/ +$/u, '')
  assert.ok(visibleIdentity.endsWith('…'),
    `The overlong identity on heading row ${row} must end with the Unicode ellipsis\n${text}`)
  const visibleIdentityPrefix = visibleIdentity.slice(0, -1)
  assert.ok(fullIdentity.startsWith(visibleIdentityPrefix),
    `The visible identity before the ellipsis must be a prefix of the full identity\n${text}`)
  assert.ok(!visibleIdentity.includes(fullIdentity),
    `The full overlong identity must not be rendered in the heading label\n${text}`)
  assert.equal(displayWidth('…'), 1, 'The Unicode ellipsis used by the heading must occupy one terminal cell')

  const identityColumn = displayWidth(line.slice(0, identityStart))
  const visibleIdentityWidth = displayWidth(visibleIdentity)
  const costColumn = displayWidth(line.slice(0, costStartIndex))
  const costEnd = costColumn + displayWidth(reportedCost) - 1
  const availableIdentityWidth = costColumn - identityColumn - 2

  assert.equal(identityColumn, frameLeftColumn + 3,
    `The ellipsized identity on heading row ${row} must start at the padded left edge\n${text}`)
  assert.ok(displayWidth(fullIdentity) > availableIdentityWidth,
    `The fixture identity must exceed the available terminal-cell width\n${text}`)
  assert.ok(visibleIdentityWidth <= availableIdentityWidth,
    `The visible identity must fit before the two-cell gap and right-justified cost\n${text}`)
  assert.ok(visibleIdentityWidth >= availableIdentityWidth - 1,
    `The visible identity must use all but at most one cell of its available terminal width\n${text}`)
  assert.ok(costColumn >= identityColumn + visibleIdentityWidth + 2,
    `The ellipsized identity must leave the existing two-cell gap before its reported cost\n${text}`)
  assert.equal(costEnd, frameRightColumn - 3,
    `The reported cost on heading row ${row} must remain right-justified inside the panel padding\n${text}`)
}

export function panelHasPairHeadingPrefix(text, identityPrefix) {
  const frame = panelFrame(text)
  if (!frame) return false
  const frameLeftColumn = displayWidth(frame.lines[frame.top].slice(0, frame.left))
  return text.split('\n').some(line => {
    const identityStart = line.indexOf(identityPrefix)
    return identityStart >= 0 && displayWidth(line.slice(0, identityStart)) === frameLeftColumn + 3
  })
}

export async function refreshPairIdentity(world, { agent, providerID, modelID, sequence }) {
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = [
      message(`generated-identity-${sequence}`, agent, { providerID, id: modelID }, 1),
    ]
    fixture.messages.ses_oats_child = []
    fixture.models = [modelInfo(providerID, modelID)]
    fixture.events.push({
      id: `generated-identity-refresh-${sequence}-${fixture.events.length}`,
      type: 'session.moved',
      data: { sessionID: fixture.rootSession },
    })
  })
}

export function formattedCount(value) {
  return value.toLocaleString('en-US')
}

function numericFields(line, label) {
  const labelMatch = new RegExp(`^\\s*[│|]?\\s*${label}\\b`, 'i').exec(line)
  assert.ok(labelMatch, `Missing ${label} row: ${line}`)
  const suffixStart = labelMatch.index + labelMatch[0].length
  const fields = []
  for (const match of line.slice(suffixStart).matchAll(/(\$?\d[\d,]*(?:\.\d+)?)(e?)/g)) {
    const start = suffixStart + match.index
    const number = match[1]
    fields.push({
      value: number,
      marker: match[2],
      numericEnd: displayWidth(line.slice(0, start + number.length)) - 1,
    })
  }
  return fields
}

export function assertNumericTableAlignment(text, values, incompleteMask) {
  const lines = text.split('\n')
  const frame = panelFrame(text)
  assert.ok(frame, `The numeric usage table must be enclosed by the details panel before alignment is checked\n${text}`)
  const headerRow = lines.findIndex(line => /input\s+output\s+cache write\s+cache read/i.test(line))
  assert.ok(headerRow >= 0, `The table's four category headings must be visible before numeric alignment is checked\n${text}`)
  const headings = ['input', 'output', 'cache write', 'cache read']
  const headingStarts = headings.map(label => {
    const column = lines[headerRow].indexOf(label)
    assert.ok(column >= 0, `Missing table heading "${label}"\n${text}`)
    return displayWidth(lines[headerRow].slice(0, column))
  })
  const rows = Object.fromEntries(['Price', 'Tokens', 'Cost'].map(label => [label, lineWith(text, label)]))
  const fields = Object.fromEntries(Object.entries(rows).map(([label, line]) => [label, numericFields(line, label)]))
  for (const label of ['Price', 'Tokens', 'Cost']) {
    assert.equal(fields[label].length, 4, `The ${label} row must expose four numeric category cells\n${text}`)
  }

  const cellsByRow = Object.fromEntries(Object.entries(rows).map(([label, line]) => [label, terminalCells(line)]))
  for (let index = 0; index < 4; index++) {
    const price = fields.Price[index]
    const tokens = fields.Tokens[index]
    const cost = fields.Cost[index]
    const expectedMarker = (incompleteMask & (1 << index)) === 0 ? '' : 'e'
    assert.equal(tokens.value.replaceAll(',', ''), String(values[index]), `Token category ${index} must show its generated value\n${text}`)
    assert.equal(tokens.marker, expectedMarker, `Token category ${index} must have the expected completeness marker\n${text}`)
    assert.equal(price.marker, '', `Price category ${index} must not acquire an incompleteness marker\n${text}`)
    assert.equal(cost.marker, 'e', `Estimated cost category ${index} must retain its trailing e marker\n${text}`)
    assert.equal(price.numericEnd, cost.numericEnd,
      `Price and estimated cost numbers in category ${index} must share a right-aligned numeric edge\n${text}`)
    assert.equal(tokens.numericEnd, cost.numericEnd,
      `Complete/partial token number in category ${index} must share the estimated-cost numeric edge\n${text}`)

    const markerColumn = cost.numericEnd + 1
    assert.ok(markerColumn >= headingStarts[index],
      `Category ${index} numeric data must be positioned under its heading\n${text}`)
    assert.ok(index === 3 || markerColumn < headingStarts[index + 1],
      `Category ${index} numeric data must end before the next category heading\n${text}`)
    assert.ok(index === 0 || markerColumn > fields.Cost[index - 1].numericEnd + 1,
      `Each numeric category must retain a distinct ordered column edge\n${text}`)
    assert.ok(markerColumn <= frame.right - 3,
      `Category ${index} and its marker cell must remain inside the two-cell right panel inset\n${text}`)
    assert.equal(cellsByRow.Price[markerColumn], ' ', `Price category ${index} must reserve a blank marker cell\n${text}`)
    assert.equal(cellsByRow.Tokens[markerColumn], expectedMarker || ' ',
      `Token category ${index} must keep the optional e marker in its reserved cell\n${text}`)
    assert.equal(cellsByRow.Cost[markerColumn], 'e', `Estimated cost category ${index} must use the reserved marker cell\n${text}`)
  }
}

export async function refreshTokenAlignment(world, values, incompleteMask, sequence) {
  const agent = `align-${sequence}`
  const completeTokens = {
    input: values[0],
    output: values[1],
    reasoning: 0,
    cache: { write: values[2], read: values[3] },
  }
  const partialTokens = {
    input: incompleteMask & 1 ? null : 0,
    output: incompleteMask & 2 ? null : 0,
    reasoning: incompleteMask & 2 ? null : 0,
    cache: {
      write: incompleteMask & 4 ? null : 0,
      read: incompleteMask & 8 ? null : 0,
    },
  }
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = [
      message(`alignment-complete-${sequence}`, agent, model, 1, completeTokens),
      message(`alignment-partial-${sequence}`, agent, model, 1, partialTokens),
    ]
    fixture.messages.ses_oats_child = []
    fixture.events.push({ id: `alignment-refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
  return agent
}

export async function assertEscButtonAtUpperRight(world) {
  const text = await modal(world)
  const button = locateExactLabel(text, 'esc')
  assert.ok(button, `The exact lowercase "esc" button label must be visible\n${text}`)

  const frame = panelFrame(text)
  assert.ok(frame, `The usage details panel must have a visible border before the esc position is checked\n${text}`)

  const width = frame.right - frame.left
  assert.equal(button.row, frame.top + 2, `The esc button must follow one vertical padding row inside the panel\n${text}`)
  assert.ok(button.column >= frame.left + Math.floor(width * 2 / 3), `The esc button must be at the panel's upper-right\n${text}`)
  assert.equal(displayWidth(text.split('\n')[button.row].slice(0, button.column)) + 2, frame.right - 3,
    `The esc button must leave two horizontal padding cells before the right border\n${text}`)
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
