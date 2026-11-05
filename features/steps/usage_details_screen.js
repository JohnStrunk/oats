// Pure terminal-screen parsing for usage details. This module intentionally has
// no Cucumber hooks or process state so unit tests can import it directly.

import { displayWidth } from '../real-host-tests/terminal_screen.js'

const BORDER_TOP_LEFT = new Set(['┌', '╭', '┏', '╔', '╒', '╓', '+'])
const BORDER_TOP_RIGHT = new Set(['┐', '╮', '┓', '╗', '╕', '╖', '+'])
const BORDER_BOTTOM_LEFT = new Set(['└', '╰', '┗', '╚', '╘', '╙', '+'])
const BORDER_BOTTOM_RIGHT = new Set(['┘', '╯', '┛', '╝', '╛', '╜', '+'])
const BORDER_HORIZONTAL = new Set(['─', '━', '═', '-', '='])
const BORDER_VERTICAL = new Set(['│', '┃', '║', '|'])

// A frame needs at least one interior column and two interior rows so its
// corners, sides, and table content cannot be the same cells.
const MIN_FRAME_WIDTH = 4
const MIN_FRAME_HEIGHT = 3

// The `@opencode/cli` 2.1.4 pinned by
// `.github/tooling/opencode-host/package.json` renders `size: 'large'` dialogs
// 88 columns wide, and the usage panel pins its bordered surface to 30 rows.
// Bounding the blank panel check to those dimensions keeps unrelated borders
// from reading as the modal when its title and table have been clipped or
// emptied.
const PINNED_HOST_LARGE_DIALOG_WIDTH = 88
const USAGE_DETAILS_PANEL_HEIGHT = 30

function horizontalBorderCells(line, left, right) {
  let count = 0
  for (let x = left + 1; x < right; x++) {
    if (BORDER_HORIZONTAL.has(line[x])) count++
  }
  return count
}

function horizontalBorderRow(line, left, right) {
  return horizontalBorderCells(line, left, right) >= Math.max(3, Math.floor((right - left - 1) / 2))
}

function hasTopBorder(line, left, right) {
  return BORDER_TOP_LEFT.has(line[left]) &&
    BORDER_TOP_RIGHT.has(line[right]) &&
    horizontalBorderRow(line, left, right)
}

function hasBottomBorder(line, left, right) {
  return BORDER_BOTTOM_LEFT.has(line[left]) &&
    BORDER_BOTTOM_RIGHT.has(line[right]) &&
    horizontalBorderRow(line, left, right)
}

function hasVerticalSides(lines, top, bottom, left, right) {
  for (let y = top + 1; y < bottom; y++) {
    const cells = terminalCells(lines[y])
    if (!BORDER_VERTICAL.has(cells[left]) || !BORDER_VERTICAL.has(cells[right])) return false
  }
  return true
}

function findRightEdge(line, left) {
  for (let right = left + MIN_FRAME_WIDTH; right < line.length; right++) {
    if (hasTopBorder(line, left, right)) return right
  }
  return -1
}

function findBottomEdge(lines, top, left, right) {
  for (let bottom = top + MIN_FRAME_HEIGHT; bottom < lines.length; bottom++) {
    if (!hasBottomBorder(lines[bottom], left, right)) continue
    if (hasVerticalSides(lines, top, bottom, left, right)) return bottom
  }
  return -1
}

function hasUsageDetailsTable(text) {
  return /\bPrice\b/.test(text) && /\bTokens\b/.test(text) && /\bCost\b/.test(text)
}

function frameInside(lines, top, bottom, left, right) {
  return lines.slice(top + 1, bottom).map(line => terminalCells(line).slice(left + 1, right).join('')).join('\n')
}

function frameFrom(lines, top, left, acceptFrame) {
  const right = findRightEdge(lines[top], left)
  if (right < 0) return null
  const bottom = findBottomEdge(lines, top, left, right)
  if (bottom < 0) return null
  const frame = { top, bottom, left, right, lines }
  if (!acceptFrame(frame, frameInside(lines, top, bottom, left, right))) return null
  return frame
}

function findFrame(lines, acceptFrame) {
  for (let top = 0; top < lines.length; top++) {
    for (let left = 0; left < lines[top].length; left++) {
      if (!BORDER_TOP_LEFT.has(lines[top][left])) continue
      const frame = frameFrom(lines, top, left, acceptFrame)
      if (frame) return frame
    }
  }
  return null
}

export function panelFrame(text) {
  return findFrame(text.split('\n'), (_frame, inside) => hasUsageDetailsTable(inside))
}

export function pinnedUsagePanelFrame(text) {
  return findFrame(text.split('\n'), frame =>
    frame.right - frame.left + 1 === PINNED_HOST_LARGE_DIALOG_WIDTH &&
    frame.bottom - frame.top + 1 === USAGE_DETAILS_PANEL_HEIGHT)
}

export function locateText(text, value) {
  const lines = text.split('\n')
  for (let row = 0; row < lines.length; row++) {
    const column = lines[row].indexOf(value)
    if (column >= 0) return { row, column }
  }
  return null
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function locateExactLabel(text, value) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(value)})(?=$|[^A-Za-z0-9_])`)
  const lines = text.split('\n')
  for (let row = 0; row < lines.length; row++) {
    const match = pattern.exec(lines[row])
    if (match) return { row, column: match.index + match[1].length }
  }
  return null
}

export function hasDetailsModal(text) {
  // A frame whose title or table is clipped/empty is still the open modal, so
  // check the pinned panel border in addition to its visible content.
  return text.includes('Agent cost details') ||
    hasUsageDetailsTable(text) ||
    Boolean(pinnedUsagePanelFrame(text))
}

// Match the label at the start of a table row. The modal title ("Agent cost
// details") also contains "cost", so an unanchored match would select the
// title before the Cost row.
export function lineWith(text, label) {
  const pattern = new RegExp(`^\\s*[│|]?\\s*${escapeRegExp(label)}\\b`, 'i')
  return text.split('\n').find(line => pattern.test(line)) ?? ''
}

// Compare numeric row values without requiring decorative currency symbols,
// separators, alignment, or a particular number of trailing fractional zeros.
export function rowNumbers(text, label) {
  const line = lineWith(text, label).replace(new RegExp(`.*?\\b${escapeRegExp(label)}\\b`, 'i'), '')
  return (line.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(value => Number(value.replaceAll(',', '')))
}

export function markedNumbers(text, label) {
  const values = lineWith(text, label).replace(new RegExp(`.*?\\b${escapeRegExp(label)}\\b`, 'i'), '')
  return (values.match(/(?:e\s*\$?-?\d[\d,]*(?:\.\d+)?|\$?-?\d[\d,]*(?:\.\d+)?\s*e)/g) ?? []).length
}

// Convert a rendered PTY row back to terminal cells. The screen parser joins a
// wide glyph and its continuation cell into one JavaScript string, so indexes
// and display columns differ for CJK text.
export function terminalCells(line) {
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
