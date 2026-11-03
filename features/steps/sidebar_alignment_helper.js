import { rowFor, sectionIsCollapsed, sidebarAgentRows, sidebarSectionLines } from './sidebar_section_helper.js'
import { terminalCellWidth } from './sidebar_east_asian_width.js'

// Inspect the rendered terminal screen, not the plugin's formatting helpers.
// Test labels and values are ASCII, so string indexes are terminal columns.
export function inspectAlignment(text, expected) {
  const rows = sidebarAgentRows(text)
  if (rows.length !== expected.length) return false
  let left, valueEnd
  for (const { label, value, marker } of expected) {
    const row = rowFor(text, label)
    if (!row || rows.filter(item => item.name === label).length !== 1) return false
    const labelAt = row.indexOf(label)
    const valueAt = row.lastIndexOf(value)
    if (labelAt < 0 || valueAt <= labelAt + label.length - 1) return false
    // Only a separator is permitted between the label and the amount.
    if (!/^\s*:?\s*$/.test(row.slice(labelAt + label.length, valueAt))) return false
    const end = valueAt + value.length
    const nextChar = row[end] ?? ' '
    if (marker === 'e') {
      if (nextChar !== 'e') return false
    } else {
      if (nextChar !== ' ') return false
    }
    // No old marker, duplicated value, or other content can follow the marker.
    const remainder = marker === 'e' ? row.slice(end + 1) : row.slice(end)
    if (!/^\s*[│┃]?\s*$/.test(remainder)) return false
    left ??= labelAt
    valueEnd ??= end
    if (left !== labelAt || valueEnd !== end) return false
    // Values must be right-aligned across the sidebar width, not left-packed.
    // In a 30+ column sidebar content area, the span between label start
    // and value end must be at least 20 terminal columns.
    if (end - labelAt < 20) return false
  }
  return true
}

export function legendCount(text) {
  if (sectionIsCollapsed(text)) return 0
  return sidebarSectionLines(text).filter(line => line.trim() === 'e = estimated').length
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectedVisibleName(name, width) {
  if (terminalCellWidth(name) <= width) return name
  let visible = ''
  let used = 0
  for (const character of name) {
    const characterWidth = terminalCellWidth(character)
    if (used + characterWidth + 1 > width) break
    visible += character
    used += characterWidth
  }
  return `${visible}…`
}

function rowHasMarker(row, expected) {
  if (row.value !== expected.value) return false
  const suffix = row.tail.trim()
  const parsed = new RegExp(`^${escapeRegExp(row.value)}(e)?\\s*[│┃]?$`).exec(suffix)
  return parsed !== null && (parsed[1] ?? 'blank') === expected.marker
}

function rowNameWidth(row) {
  const nameAt = row.line.indexOf(row.name)
  const valueAt = row.line.lastIndexOf(row.value)
  if (nameAt < 0 || valueAt < 0) return null
  const nameColumn = terminalCellWidth(row.line.slice(0, nameAt))
  const valueColumn = terminalCellWidth(row.line.slice(0, valueAt))
  return {
    nameWidth: valueColumn - nameColumn - 2, // colon and one separator cell
    valueAt,
    valueColumn,
  }
}

// Inspect each real PTY-rendered row. The value's current column gives the
// width that remains for its name after the mandatory colon and separating
// cell; different value/marker widths therefore yield different name budgets.
export function inspectAgentNameSizing(text, expected) {
  const rows = sidebarAgentRows(text)
  if (rows.length !== expected.length) return false

  let valueEnd
  for (const item of expected) {
    const matches = rows.filter(row => rowHasMarker(row, item))
    if (matches.length !== 1) return false

    const row = matches[0]
    const geometry = rowNameWidth(row)
    if (!geometry) return false
    const { nameWidth, valueAt, valueColumn } = geometry
    if (nameWidth < 1 || row.name !== expectedVisibleName(item.name, nameWidth)) return false
    if (item.must_be_full === 'yes' && terminalCellWidth(item.name) > nameWidth) return false

    const currentValueEnd = valueColumn + terminalCellWidth(row.value)
    if (valueEnd !== undefined && currentValueEnd !== valueEnd) return false
    valueEnd ??= currentValueEnd

    const markerAt = valueAt + row.value.length
    const marker = row.line[markerAt] ?? ''
    if (item.marker === 'e' ? marker !== 'e' : marker !== '' && !/\s|[│┃]/.test(marker)) return false
    if (terminalCellWidth(row.line) > currentValueEnd + 1) return false
  }
  return true
}

// Verify the collision exception against actual PTY rows. The source names
// must truncate to at least one shared candidate at their measured row widths,
// while the displayed labels remain unique and inside those same widths.
export function inspectAgentNameCollisions(text, expected) {
  const rows = sidebarAgentRows(text)
  if (expected.length < 2 || rows.length !== expected.length) return false

  const entries = []
  let valueEnd
  for (const [index, item] of expected.entries()) {
    const matches = rows.filter(row => rowHasMarker(row, item))
    if (matches.length !== 1) return false

    const row = matches[0]
    const geometry = rowNameWidth(row)
    if (!geometry) return false
    const { nameWidth, valueAt, valueColumn } = geometry
    if (nameWidth < 1 || terminalCellWidth(item.name) <= nameWidth) return false
    if (terminalCellWidth(row.name) > nameWidth) return false

    entries.push({ item, index, row, nameWidth, fittedName: expectedVisibleName(item.name, nameWidth) })

    const currentValueEnd = valueColumn + terminalCellWidth(row.value)
    if (valueEnd !== undefined && currentValueEnd !== valueEnd) return false
    valueEnd ??= currentValueEnd
    if (terminalCellWidth(row.line) > currentValueEnd + 1) return false
    const markerAt = valueAt + row.value.length
    const marker = row.line[markerAt] ?? ''
    if (item.marker === 'e' ? marker !== 'e' : marker !== '' && !/\s|[│┃]/.test(marker)) return false
  }

  const candidateCounts = new Map()
  for (const { fittedName } of entries) {
    candidateCounts.set(fittedName, (candidateCounts.get(fittedName) ?? 0) + 1)
  }
  const collisionEntries = entries.filter(entry => candidateCounts.get(entry.fittedName) > 1)
  if (!collisionEntries.length) return false

  // Collision suffixes are assigned in source-name order, independently of
  // terminal row order. Reconstruct each label from that row's source name and
  // its cost/marker-matched width instead of merely checking label uniqueness.
  collisionEntries.sort((left, right) => {
    if (left.item.name !== right.item.name) return left.item.name < right.item.name ? -1 : 1
    return left.index - right.index
  })
  const suffixes = new Map()
  let suffixNumber = 1
  for (const entry of collisionEntries) suffixes.set(entry, ` #${(suffixNumber++).toString(36)}`)

  for (const entry of entries) {
    const suffix = suffixes.get(entry)
    let expectedLabel = entry.fittedName
    if (suffix) {
      const suffixWidth = terminalCellWidth(suffix)
      expectedLabel = entry.nameWidth > suffixWidth
        ? `${expectedVisibleName(entry.item.name, entry.nameWidth - suffixWidth)}${suffix}`
        : `#${suffix.slice(2)}`
    }
    if (entry.row.name !== expectedLabel) return false
  }

  return new Set(entries.map(entry => entry.row.name)).size === expected.length
}
