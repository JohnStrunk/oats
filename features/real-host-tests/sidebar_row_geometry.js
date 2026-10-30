// Screen-space geometry for rendered Agent stats cost rows.
//
// The real host lays plugin text out in its sidebar and trims trailing blanks
// from every line, so row alignment is only observable through the columns of
// the label, value and marker. Parse those from the rendered screen rather than
// reusing the plugin's formatting helpers, which would make the assertion
// tautological.

import { displayWidth } from './terminal_screen.js'

const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Every rendered value shape: an exact amount, a directional bound, or the
// unknown-total placeholder. Formatting details of the amount are not this
// helper's concern; they are asserted by the caller.
const VALUE = String.raw`[<>]?-?\$\d+\.\d{2}|unavailable`

/**
 * Find the rendered cost row for `label` and report its screen columns.
 *
 * A row is `<indent><label>[:]<padding><value>[e]` on a single line. Columns
 * are 1-based terminal cells. `marker` is empty when no `e` follows the value;
 * that position is the reserved marker column in either case.
 */
export function costRow(screenText, label) {
  const pattern = new RegExp(
    `^(\\s*)${escapePattern(label)}\\s*:?\\s*(${VALUE})(e)?$`,
  )
  const lines = screenText.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = pattern.exec(line)
    if (!match) continue
    const value = match[2]
    const marker = match[3] ?? ''
    // The value and marker end the line, so their start is fixed by its length.
    const valueStart = line.length - value.length - marker.length
    const valueColumn = displayWidth(line.slice(0, valueStart)) + 1
    return {
      row: index + 1,
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

/** Lines whose trimmed content is exactly the incomplete-total legend. */
export function legendLines(screenText) {
  return screenText
    .split('\n')
    .filter(line => line.trim() === 'e = incomplete total')
}
