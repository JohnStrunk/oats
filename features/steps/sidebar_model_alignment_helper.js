import { terminalCellWidth } from './sidebar_east_asian_width.js'
import { modelSidebarRows } from './model_sidebar_helper.js'

export function inspectModelAlignment(text, expected) {
  const rows = modelSidebarRows(text)
  if (rows.length !== expected.length) return false
  let labelColumn, valueEnd
  for (const item of expected) {
    const matches = rows.filter(row => row.name === item.label)
    if (matches.length !== 1) return false
    const row = matches[0]
    const labelAt = row.line.indexOf(row.name)
    const valueAt = row.line.lastIndexOf(item.value)
    if (labelAt < 0 || valueAt <= labelAt + row.name.length - 1) return false
    if (row.value !== item.value) return false
    if (!/^\s*:?\s*$/.test(row.line.slice(labelAt + row.name.length, valueAt))) return false

    const end = valueAt + item.value.length
    const next = row.line[end] ?? ' '
    if (item.marker === 'e' ? next !== 'e' : next !== ' ') return false
    const remainder = item.marker === 'e' ? row.line.slice(end + 1) : row.line.slice(end)
    if (!/^\s*[│┃]?\s*$/.test(remainder)) return false

    const nextLabelColumn = terminalCellWidth(row.line.slice(0, labelAt))
    const nextValueEnd = terminalCellWidth(row.line.slice(0, end))
    labelColumn ??= nextLabelColumn
    valueEnd ??= nextValueEnd
    if (labelColumn !== nextLabelColumn || valueEnd !== nextValueEnd) return false
    if (nextValueEnd - nextLabelColumn < 20) return false
  }
  return true
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

function normalizeVisibleName(name) {
  return name.replace(/\s+/gu, ' ').trim()
}

export function inspectModelNameSizing(text, expected) {
  const rows = modelSidebarRows(text)
  if (rows.length !== expected.length) return false
  const entries = []

  for (const item of expected) {
    const matches = rows.filter(row => row.value === item.cost)
    if (matches.length !== 1) return false
    const row = matches[0]
    const labelAt = row.line.indexOf(row.name)
    const valueAt = row.line.lastIndexOf(row.value)
    if (labelAt < 0 || valueAt < 0) return false
    const labelColumn = terminalCellWidth(row.line.slice(0, labelAt))
    const valueColumn = terminalCellWidth(row.line.slice(0, valueAt))
    const nameWidth = valueColumn - labelColumn - 2
    if (nameWidth < 1 || terminalCellWidth(row.name) > nameWidth) return false
    if (item.must_be_full === 'yes' && terminalCellWidth(item.identifier) > nameWidth) return false
    entries.push({ item, row, nameWidth, candidate: expectedVisibleName(item.identifier, nameWidth) })
  }

  const candidateCounts = new Map()
  for (const { candidate } of entries) {
    const normalized = normalizeVisibleName(candidate)
    candidateCounts.set(normalized, (candidateCounts.get(normalized) ?? 0) + 1)
  }
  const collidingEntries = entries.filter(entry =>
    candidateCounts.get(normalizeVisibleName(entry.candidate)) > 1)
  collidingEntries.sort((left, right) => {
    if (left.item.identifier !== right.item.identifier) {
      return left.item.identifier < right.item.identifier ? -1 : 1
    }
    return entries.indexOf(left) - entries.indexOf(right)
  })

  const suffixes = new Map()
  let suffixNumber = 1
  for (const entry of collidingEntries) suffixes.set(entry, ` #${(suffixNumber++).toString(36)}`)

  for (const entry of entries) {
    const suffix = suffixes.get(entry)
    let expectedLabel = entry.candidate
    if (suffix) {
      const suffixWidth = terminalCellWidth(suffix)
      expectedLabel = entry.nameWidth > suffixWidth
        ? `${expectedVisibleName(entry.item.identifier, entry.nameWidth - suffixWidth)}${suffix}`
        : `#${suffix.slice(2)}`
    }
    if (entry.row.name !== expectedLabel) return false
  }

  return new Set(entries.map(entry => normalizeVisibleName(entry.row.name))).size === entries.length
}

export function inspectGeneratedModelName(text, identifier, cost) {
  const rows = modelSidebarRows(text)
  const matches = rows.filter(row => row.amount === cost)
  if (matches.length !== 1) return false
  const row = matches[0]
  const labelAt = row.line.indexOf(row.name)
  const valueAt = row.line.lastIndexOf(row.value)
  if (labelAt < 0 || valueAt < 0) return false
  const labelColumn = terminalCellWidth(row.line.slice(0, labelAt))
  const valueColumn = terminalCellWidth(row.line.slice(0, valueAt))
  const nameWidth = valueColumn - labelColumn - 2
  if (nameWidth < 1 || terminalCellWidth(row.name) > nameWidth) return false

  if (terminalCellWidth(identifier) <= nameWidth) return row.name === identifier
  if (row.name === identifier || !row.name.startsWith(identifier.slice(0, 5))) return false
  return row.name.includes('…') || / #?[0-9a-z]+$/i.test(row.name)
}
