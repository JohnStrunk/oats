import { rowFor, sectionIsCollapsed, sidebarAgentRows, sidebarSectionLines } from './sidebar_section_helper.js'

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
  return sidebarSectionLines(text).filter(line => line.trim() === 'e = incomplete total').length
}
