import assert from 'node:assert/strict'
import test from 'node:test'
import { charWidth, textWidth } from '../../src/display-width.js'

test('printable ASCII and host-measured narrow glyphs occupy one cell', () => {
  assert.equal(textWidth('agent-00'), 8)
  assert.equal(charWidth('…'), 1)
  assert.equal(charWidth('�'), 1)
})

test('non-ASCII code points are counted conservatively as two cells', () => {
  // The host renders this narrow glyph in one cell, but the sidebar helper
  // deliberately overestimates so a missed wide range cannot clip a row.
  assert.equal(charWidth('é'), 2)
  assert.equal(textWidth('代理'), 4)
  assert.equal(textWidth('𛀀'), 2) // Kana Supplement U+1B000
  assert.equal(textWidth('😀'), 2)
  assert.equal(textWidth('a代b'), 4)
})

test('a supplementary-plane code point is measured once, not once per UTF-16 code unit', () => {
  const supplementary = '𛀀' // Kana Supplement U+1B000
  assert.equal(supplementary.length, 2)
  assert.equal([...supplementary].length, 1)
  assert.equal(textWidth(supplementary), 2)
})
