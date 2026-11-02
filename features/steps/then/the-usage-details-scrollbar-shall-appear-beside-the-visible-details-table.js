import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually } from '../usage_details_helper.js'
import { firstScrollAgent, model } from '../usage_details_fixture.js'
import { displayWidth } from '../../real-host-tests/terminal_screen.js'

const SCROLLBAR_GLYPHS = new Set(['█', '▀', '▄'])
const MODEL_HEADING = `${model.providerID}/${model.id}`

// Rebuild the terminal cell grid from a rendered line. The screen model stores
// a wide glyph in one cell and an empty continuation cell after it, and
// attaches zero-width marks to the preceding glyph, so string indices and cell
// columns diverge for Unicode content. The independent displayWidth oracle
// supplies each code point's cell count.
//
// The current fixtures only use glyphs this oracle and the PTY driver in
// sidebar_pty_driver.js measure identically (ASCII, é, 代, and the scrollbar
// block glyphs); the driver additionally treats U+1F300..U+1FAFF as wide,
// which this oracle does not. A future emoji or East Asian ambiguous-width
// fixture must align both width models or measure through one shared cell
// oracle before relying on this comparison.
function terminalCells(line) {
  const cells = []
  for (const char of line) {
    const width = displayWidth(char)
    if (width === 0) {
      if (cells.length > 0) cells[cells.length - 1] += char
      continue
    }
    cells.push(char)
    if (width === 2) cells.push('')
  }
  return cells
}

// Measure the rendered table text with the independent real-host display-width
// oracle. Scrollbar glyphs are removed first so the expected edge comes from
// the content itself, not from where the host actually drew the thumb.
// The fixture table content currently contains no scrollbar glyphs, so this
// filter only strips the host-drawn scrollbar. A future fixture that uses
// '█', '▀', or '▄' in its content must anchor the scrollbar structurally
// instead of excluding those glyphs from the content measurement.
function renderedWidth(cells) {
  const content = cells.filter(char => !SCROLLBAR_GLYPHS.has(char)).join('').trimEnd()
  return displayWidth(content)
}

// Locate the first visible table by its full heading, not just the provider and
// model. Checking the fixture's leading agent label means a truncated, wrapped,
// or missing Unicode label keeps the table from being recognized.
function scrollbarLayout(text, fixtureName) {
  const agentLabel = firstScrollAgent(fixtureName)
  const lines = text.split('\n')
  const heading = `${agentLabel} - ${MODEL_HEADING}  `
  const headingRow = lines.findIndex(line => line.includes(heading))
  if (headingRow === -1) return { ready: false, reason: `the first usage details table heading "${heading.trimEnd()}" is not yet visible` }

  const headerRow = lines.findIndex((line, index) => index > headingRow && /input\s+output\s+cache write\s+cache read/i.test(line))
  if (headerRow === -1) return { ready: false, reason: 'the first usage details table headings are not yet visible' }
  const sidebarHeader = lines.find(line => line.includes('Agent stats (details)'))
  if (!sidebarHeader) return { ready: false, reason: 'the sidebar details link is not visible to establish the right boundary' }
  // Sidebar rows share terminal lines with the modal and start further right
  // than the "(details)" link text, so the sidebar heading is the left boundary
  // for measuring the modal's own columns.
  const sidebarLeft = displayWidth(sidebarHeader.slice(0, sidebarHeader.indexOf('Agent stats')))
  const tableRows = lines.slice(headingRow, headerRow + 4)
    .map(line => terminalCells(line).slice(0, sidebarLeft))
  const contentRight = Math.max(...tableRows.map(renderedWidth))
  if (sidebarLeft <= contentRight) return { ready: false, reason: 'the visible table and sidebar do not occupy distinct horizontal columns' }

  // The scrollbox is exactly one cell wider than its widest content line, so
  // its one-cell scrollbar occupies the column immediately after that line and
  // nothing further right. Allowing an extra column would accept a thumb in the
  // gap outside the box, or beside the sidebar for a full-width outer box, so
  // only the adjacent column counts. The sidebar guard above keeps that column
  // strictly left of the sidebar.
  const firstVisibleRow = Math.max(0, headingRow - 2)
  const visibleRows = lines.slice(firstVisibleRow, headingRow + 5).map(terminalCells)
  for (let row = 0; row + 1 < visibleRows.length; row++) {
    if (SCROLLBAR_GLYPHS.has(visibleRows[row][contentRight]) && SCROLLBAR_GLYPHS.has(visibleRows[row + 1][contentRight])) return { ready: true }
  }
  return { ready: false, reason: 'the vertical scrollbar thumb is not displayed beside the visible details table' }
}

// Only the "scroll" host fixtures have enough pair tables to overflow the modal
// viewport, so this screen-based check observes their first visible table
// rather than a general sidebar layout.
Then('the usage details scrollbar shall appear beside the visible details table', { timeout: 15000 }, async function () {
  let reason = 'the vertical scrollbar thumb is not displayed beside the visible details table'
  try {
    await eventually(this, text => {
      const layout = scrollbarLayout(text, this.detailsFixtureName)
      reason = layout.reason
      return layout.ready
    }, 'the usage details scrollbar layout must become visible')
  } catch (error) {
    if (error.code === 'ERR_ASSERTION' && error.message.includes('Last terminal screen:')) {
      assert.fail(`${reason}\n${error.message}`)
    }
    throw error
  }
})
