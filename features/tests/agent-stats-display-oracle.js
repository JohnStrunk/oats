// Independent layout oracle for the Agent stats sidebar rows. Keep this out of
// src/agent-stats.js so a formatting regression cannot validate itself.

export const INCOMPLETE_LEGEND = 'e = incomplete total'

// The pinned host's sidebar is 42 cells wide: 2 left padding, 2 right padding
// and 1 right scrollbar cell. Use the resulting 37-cell content edge as an
// upper bound without hard-coding it as the only valid layout width.
export const MAX_HOST_CONTENT_WIDTH = 37

// Concrete cell widths measured on the pinned host. ASCII printable and the
// ambiguous-width ellipsis/replacement character occupy one cell; CJK, Kana
// Supplement and emoji occupy two. Tests that use other code points must add
// them here so the oracle never silently guesses.
const HOST_CELL_WIDTHS = new Map([
  [0x2026, 1], // … horizontal ellipsis
  [0xfffd, 1], // � replacement character
  [0x1b000, 2], // Kana Supplement
  [0x4ee3, 2], // 代 CJK
  [0x7406, 2], // 理 CJK
  [0x1f600, 2], // 😀 emoji
])

export function displayWidth(text) {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code >= 0x20 && code <= 0x7e) {
      width += 1
      continue
    }
    const known = HOST_CELL_WIDTHS.get(code)
    if (known === undefined) {
      throw new Error(`display width oracle lacks U+${code.toString(16).toUpperCase()}`)
    }
    width += known
  }
  return width
}

// Parse one rendered cost row from its left edge:
//
//   label:<padding><value><marker><trailing blanks>
//
// `marker` is the single reserved cell after the value: `e` for a known
// incomplete total and a blank for complete or unknown totals.
const COST_ROW =
  /^(?<rawLabel>.*?)(?<separator>\s*:?\s*)(?<value>[<>]?-?\$[-+]?\d+\.\d{2}|unavailable)(?<marker>e?)(?<trailing> *)$/d

export function parseCostRow(line) {
  const match = COST_ROW.exec(line)
  if (!match) return null

  const { rawLabel, separator, value, marker, trailing } = match.groups
  const label = rawLabel.trimEnd()
  if (!label || !separator || !/^\s*:?\s*$/.test(separator)) return null

  const valueAt = match.indices.groups.value[0]
  const markerAt = match.indices.groups.marker[0]
  const markerSlot = marker || line[markerAt] || ''

  return {
    line,
    label,
    value,
    marker: marker || 'blank',
    markerSlot,
    labelAt: displayWidth(line.slice(0, match.indices.groups.rawLabel[0])),
    valueAt: displayWidth(line.slice(0, valueAt)),
    valueEnd: displayWidth(line.slice(0, valueAt + value.length)),
    trailingWidth: displayWidth(trailing),
    width: displayWidth(line),
  }
}

export function costRows(lines) {
  return lines.map(parseCostRow).filter(Boolean)
}

export function rowFor(lines, label) {
  return costRows(lines).find((row) => row.label === label) ?? null
}

export function legendCount(lines) {
  return lines.filter((line) => line.trim() === INCOMPLETE_LEGEND).length
}

export function rowsShareValueEnd(rows) {
  return rows.length > 0 && rows.every((row) => row.valueEnd === rows[0].valueEnd)
}
