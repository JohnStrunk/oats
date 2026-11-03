// Screen-space geometry for rendered Agent and Model stats cost rows.
//
// The real host lays plugin text out in its sidebar and trims trailing blanks
// from every line, so row alignment is only observable through the columns of
// the label, value and marker. Parse those from the rendered screen rather than
// reusing the plugin's formatting helpers, which would make the assertion
// tautological. Scope every lookup to the rendered section heading so a row or
// legend in Model stats cannot satisfy an Agent stats assertion (or vice versa).

import { displayWidth } from './terminal_screen.js'

const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SECTION_HEADING = /^\s*[▼▶]\s+(Agent stats|Model stats)(?:\s+\([^)]+\))?\s*$/

function sectionHeadingMatch(line) {
  return SECTION_HEADING.exec(line)
}

function sectionLines(screenText, sectionName) {
  const lines = screenText.split('\n')
  const headingIndex = lines.findIndex(line => sectionHeadingMatch(line)?.[1] === sectionName)
  if (headingIndex < 0) return []

  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && sectionHeadingMatch(line),
  )
  return lines
    .slice(headingIndex + 1, nextHeadingIndex < 0 ? lines.length : nextHeadingIndex)
    .map((line, index) => ({ line, row: headingIndex + index + 2 }))
}

// Every rendered value shape: an exact amount, a directional bound, or the
// unknown-total placeholder. Formatting details of the amount are not this
// helper's concern; they are asserted by the caller.
const VALUE = String.raw`[<>]?-?\$\d+\.\d{2}|unavailable`

/**
 * Find the rendered cost row for `label` and report its screen columns.
 *
 * A row is `<indent><label>[:]<padding><value>[e]` on a single line. Columns
 * are 1-based terminal cells. `marker` is empty when no `e` follows the value;
 * that position is the reserved marker column in either case. Lookups use the
 * rendered `Agent stats` section by default; pass `Model stats` for model rows.
 */
export function hasSectionHeading(screenText, sectionName = 'Agent stats') {
  return screenText.split('\n').some(line => sectionHeadingMatch(line)?.[1] === sectionName)
}

export function costRow(screenText, label, sectionName = 'Agent stats') {
  const pattern = new RegExp(
    `^(\\s*)${escapePattern(label)}\\s*:?\\s*(${VALUE})(e)?$`,
  )
  for (const { line, row } of sectionLines(screenText, sectionName)) {
    const match = pattern.exec(line)
    if (!match) continue
    const value = match[2]
    const marker = match[3] ?? ''
    // The value and marker end the line, so their start is fixed by its length.
    const valueStart = line.length - value.length - marker.length
    const valueColumn = displayWidth(line.slice(0, valueStart)) + 1
    return {
      row,
      line,
      label,
      value,
      marker,
      labelColumn: displayWidth(match[1]) + 1,
      valueColumn,
      valueEndColumn: valueColumn + displayWidth(value) - 1,
      markerColumn: valueColumn + displayWidth(value),
    }
  }
  return undefined
}

/** Lines in the selected section whose content is exactly the incomplete-total legend. */
export function legendLines(screenText, sectionName = 'Agent stats') {
  return sectionLines(screenText, sectionName)
    .filter(({ line }) => line.trim() === 'e = estimated')
    .map(({ line }) => line)
}
