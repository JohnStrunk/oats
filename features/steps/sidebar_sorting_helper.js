import assert from 'node:assert/strict'
import { eventually } from './sidebar_scenario_helper.js'
import { modelSidebarRows, modelStatsRowsMatch, modelStatsSectionLines } from './model_sidebar_helper.js'
import { sidebarAgentRows, sidebarRowsMatch, sidebarSectionLines } from './sidebar_section_helper.js'

function normalizeTerminalCursorCell(text) {
  // OpenCode's terminal-grid capture can leave a full or half-block cursor
  // cell at the end of a sidebar row. Remove only trailing block glyphs after
  // visible content before validating or parsing the rendered section.
  return text.replace(/([^\n]*\S)[ \t]*[█▀▄]+(?=[ \t]*$)/gm, '$1')
}

function renderedRows(text, stats) {
  const screen = normalizeTerminalCursorCell(text)
  if (stats === 'Agent') {
    return sidebarAgentRows(screen).map(({ name, value, tail }) => ({
      name,
      value,
      marker: /\$-?\d+\.\d{2}e(?=\s|[│┃]|$)/.test(tail) ? 'e' : 'blank',
    }))
  }
  if (stats === 'Model') {
    return modelSidebarRows(screen).map(({ name, value, marker }) => ({ name, value, marker }))
  }
  throw new Error(`unsupported sidebar stats section: ${stats}`)
}

function sectionLines(text, stats) {
  const screen = normalizeTerminalCursorCell(text)
  if (stats === 'Agent') return sidebarSectionLines(screen)
  if (stats === 'Model') return modelStatsSectionLines(screen)
  throw new Error(`unsupported sidebar stats section: ${stats}`)
}

function sameRowsIgnoringOrder(actual, expected) {
  if (actual.length !== expected.length) return false
  const unmatched = actual.slice()
  for (const row of expected) {
    const index = unmatched.findIndex(candidate =>
      candidate.name === row.name &&
      (!Object.hasOwn(row, 'value') || candidate.value === row.value) &&
      candidate.marker === row.marker)
    if (index < 0) return false
    unmatched.splice(index, 1)
  }
  return unmatched.length === 0
}

function rowsMatchAtBoundary(text, stats, expected, actual) {
  const screen = normalizeTerminalCursorCell(text)
  const specifiesValues = expected.every(row => Object.hasOwn(row, 'value'))
  if (!specifiesValues && expected.some(row => Object.hasOwn(row, 'value'))) {
    throw new Error('expected rows must either all specify displayed values or all omit them')
  }

  // Fixed acceptance tables assert their exact values. The property scenario
  // intentionally checks ordering and markers only; in that case use the
  // parsed values solely to let the existing boundary matcher validate every
  // row's syntax, count, legend, and surrounding section lines.
  const rowsForBoundary = specifiesValues ? expected : actual
  const values = new Map(rowsForBoundary.map(row => [row.name, row.value]))
  if (values.size !== rowsForBoundary.length || values.size !== expected.length) return false

  if (stats === 'Agent') return sidebarRowsMatch(screen, values)
  if (stats === 'Model') return modelStatsRowsMatch(screen, values)
  throw new Error(`unsupported sidebar stats section: ${stats}`)
}

export async function assertRenderedRowsInOrder(world, stats, expected) {
  assert.ok(Array.isArray(expected) && expected.length > 0,
    `${stats} stats ordering assertion must expect at least one row`)
  const text = await eventually(world, screen =>
    (() => {
      const actual = renderedRows(screen, stats)
      return sameRowsIgnoringOrder(actual, expected) &&
        rowsMatchAtBoundary(screen, stats, expected, actual)
    })(),
  `${stats} stats must contain only well-formed rows with the expected labels, values, and incomplete markers`)
  const actual = renderedRows(text, stats)
  const orderedRows = expected.every(row => Object.hasOwn(row, 'value'))
    ? actual
    : actual.map(({ name, marker }) => ({ name, marker }))
  assert.deepEqual(orderedRows, expected,
    `${stats} stats row sequence must follow exact reported totals and retain insertion order for ties`)

  const legendCount = sectionLines(text, stats).filter(line => line.trim() === 'e = estimated').length
  assert.equal(legendCount, expected.some(row => row.marker === 'e') ? 1 : 0,
    `${stats} stats must show the incomplete legend exactly when a row has an e marker`)
}
