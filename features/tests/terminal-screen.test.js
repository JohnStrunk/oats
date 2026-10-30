import assert from 'node:assert/strict'
import test from 'node:test'
import { createTerminalScreen, displayWidth, findTextCell } from '../real-host-tests/terminal_screen.js'

// The pinned host wraps frames in DEC synchronized-output markers. Exposing the
// grid while a frame is in progress would let a transient intermediate layout
// satisfy an assertion.

test('synchronized output hides an incomplete frame until its end marker', () => {
  const screen = createTerminalScreen(20, 4)
  screen.write('committed')
  assert.match(screen.screen(), /committed/)

  screen.write('\x1b[?2026h')
  screen.write('\x1b[1;1H')
  screen.write('transient')
  assert.match(screen.screen(), /committed/)
  assert.doesNotMatch(screen.screen(), /transient/)

  screen.write('\x1b[?2026l')
  assert.match(screen.screen(), /transient/)
  assert.doesNotMatch(screen.screen(), /committed/)
})

test('split synchronized markers do not expose a partial frame', () => {
  const screen = createTerminalScreen(20, 4)
  screen.write('stable')
  screen.write('\x1b[?20')
  screen.write('26h')
  screen.write('\x1b[2;1Hpartial')
  assert.match(screen.screen(), /stable/)
  assert.doesNotMatch(screen.screen(), /partial/)

  screen.write('\x1b[?2026')
  screen.write('l')
  assert.match(screen.screen(), /partial/)
})

test('East Asian wide and fullwidth code points occupy two cells', () => {
  const width = codePoint => displayWidth(String.fromCodePoint(codePoint))
  assert.equal(width(0x1b000), 2, 'U+1B000 is East Asian Wide')
  assert.equal(width(0x1b128), 2, 'the upper end of the Kana Supplement range is wide')
  assert.equal(width(0x1b129), 1, 'the gap after the Kana Supplement range is narrow')
  assert.equal(width(0x2e80), 2)
  assert.equal(width(0xff01), 2, 'fullwidth forms are wide')
  assert.equal(width(0x20000), 2)
  assert.equal(width(0x0041), 1)
})

test('a wide glyph consumes the second cell left by a previous character', () => {
  const screen = createTerminalScreen(10, 2)
  screen.write('123456')
  screen.write('\x1b[1;1H')
  screen.write(String.fromCodePoint(0x1b000))

  const firstLine = screen.screen().split('\n')[0]
  assert.equal(firstLine, '𛀀3456', 'the previous "2" must not survive in the glyph cell')
  assert.equal(findTextCell(screen.screen(), '3').column, 3)
})

test('a charset designation split after ESC( retains its pending byte', () => {
  const screen = createTerminalScreen(20, 4)
  screen.write('before')
  screen.write('\x1b(')
  assert.match(screen.screen(), /before/)
  screen.write('Bafter')
  const rendered = screen.screen()
  assert.match(rendered, /beforeafter/)
  assert.doesNotMatch(rendered, /Bafter/, 'the charset designation byte must not become text')
})

test('a completed frame is visible before the next synchronized frame begins', () => {
  const screen = createTerminalScreen(20, 4)
  screen.write('first')
  screen.write('\x1b[?2026h\x1b[1;1Hsecond\x1b[?2026l')
  assert.match(screen.screen(), /second/)

  screen.write('\x1b[?2026h\x1b[1;1Hthird')
  assert.match(screen.screen(), /second/)
  assert.doesNotMatch(screen.screen(), /third/)

  screen.write('\x1b[?2026l')
  assert.match(screen.screen(), /third/)
})
