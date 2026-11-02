// Conservative terminal cell widths for sidebar agent labels.
//
// The pinned host renders the horizontal ellipsis and the replacement
// character in one cell. Treat every other non-ASCII code point as two cells.
// Enumerating wide ranges by hand missed assigned ranges (for example Kana
// Supplement U+1B000), and a single missed wide code point can clip a row.
// Assuming two cells is conservative: a narrow non-ASCII label is truncated or
// padded a little sooner, but the row can never exceed the host width.
//
// This helper is intentionally sidebar-only. The usage details table sizes and
// aligns mixed-width content with OpenTUI's own measurement instead.
export const TRUNCATION_MARKER = '…'
export const REPLACEMENT_CHARACTER = '�'
export const TRUNCATION_MARKER_WIDTH = 1

export function charWidth(char) {
  if (char === TRUNCATION_MARKER) return TRUNCATION_MARKER_WIDTH
  if (char === REPLACEMENT_CHARACTER) return 1
  const code = char.codePointAt(0)
  return code >= 0x20 && code <= 0x7e ? 1 : 2
}

export function textWidth(text) {
  let width = 0
  for (const char of text) width += charWidth(char)
  return width
}
