import test from 'node:test'
import assert from 'node:assert/strict'
import { terminalScreen } from '../steps/sidebar_pty_driver.js'
import { MAX_OUTPUT } from '../steps/tui_smoke_helper.js'

const begin = '\x1b[?2026h'
const end = '\x1b[?2026l'
const home = '\x1b[H'

test('a partial synchronized frame cannot satisfy a screen predicate', () => {
  const terminal = terminalScreen(30, 1)
  terminal.write('old content')
  terminal.write(begin + home + 'new content')
  assert.equal(terminal.screen(), 'old content')
  assert.equal(terminal.screen().includes('new content'), false) // negative control
  terminal.write(end)
  assert.equal(terminal.screen(), 'new content')
})

test('every split of the begin and end escapes preserves atomicity', () => {
  for (let startSplit = 0; startSplit <= begin.length; startSplit++) {
    for (let endSplit = 0; endSplit <= end.length; endSplit++) {
      const terminal = terminalScreen(30, 1)
      terminal.write('original')
      terminal.write(begin.slice(0, startSplit))
      terminal.write(begin.slice(startSplit) + home + 'changed!')
      terminal.write(end.slice(0, endSplit))
      assert.equal(terminal.screen(), endSplit === end.length ? 'changed!' : 'original', `${startSplit}/${endSplit}`)
      terminal.write(end.slice(endSplit))
      assert.equal(terminal.screen(), 'changed!', `${startSplit}/${endSplit}`)
    }
  }
})

test('sequential frames and unframed updates are observed in stream order', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old')
  terminal.write(home + 'pre' + begin + home + 'one' + end + begin + home + 'two')
  assert.equal(terminal.screen(), 'one')
  terminal.write(end + home + 'end')
  assert.equal(terminal.screen(), 'end')
  terminal.write(home + 'now')
  assert.equal(terminal.screen(), 'now')
})

test('single-character writes do not leak frame updates', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old')
  for (const char of begin + home + 'new' + end.slice(0, -1)) {
    terminal.write(char)
    assert.equal(terminal.screen(), 'old')
  }
  terminal.write(end.at(-1))
  assert.equal(terminal.screen(), 'new')
})

test('split Kana Supplement occupies two cells and does not leave a stale character', () => {
  // U+1B000 was measured as two cells on the pinned real host. Split its
  // UTF-16 surrogate pair exactly as independent PTY chunks might arrive.
  const kana = '\u{1B000}'
  const terminal = terminalScreen(10, 1)
  terminal.write('ABCDE' + begin + home)
  terminal.write(kana[0])
  assert.equal(terminal.screen(), 'ABCDE')
  terminal.write(kana[1] + 'x')
  assert.equal(terminal.screen(), 'ABCDE', 'the partial frame must remain hidden')
  terminal.write(end)
  assert.equal(terminal.screen(), `${kana}xDE`)
})

test('East Asian wide and narrow code points advance the expected number of cells', () => {
  // Independent concrete samples across Hangul, CJK, Tangut, Kana and
  // supplementary ideographs, plus halfwidth and neutral controls.
  const wide = [0x1100, 0x3000, 0x4e00, 0x16fe0, 0x17000, 0x18800, 0x18d00, 0x1aff0, 0x1b000, 0x1b128, 0x1b132, 0x1b170, 0x1f200, 0x20000, 0x30000, 0x1f680]
  for (const codePoint of wide) {
    const char = String.fromCodePoint(codePoint)
    const terminal = terminalScreen(10, 1)
    terminal.write('ABCDE' + home + char + 'x')
    assert.equal(terminal.screen(), `${char}xDE`, `U+${codePoint.toString(16).toUpperCase()} must occupy two cells`)
  }
  for (const codePoint of [0xff61, 0x1b129, 0x1b130, 0x1b131, 0x00a1, 0x41]) {
    const char = String.fromCodePoint(codePoint)
    const terminal = terminalScreen(10, 1)
    terminal.write('ABCDE' + home + char + 'x')
    assert.equal(terminal.screen(), `${char}xCDE`, `U+${codePoint.toString(16).toUpperCase()} must occupy one cell`)
  }
})

test('a wide supplementary character wraps before the last column', () => {
  const terminal = terminalScreen(4, 2)
  terminal.write('abc\u{1B000}x')
  assert.equal(terminal.screen(), 'abc\n\u{1B000}x')
})

test('nested and repeated begin markers cannot publish a partial outer frame', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old' + end) // unmatched end has no effect
  terminal.write(begin + home + 'new' + begin + home + 'mid' + end)
  assert.equal(terminal.screen(), 'old')
  terminal.write(home + 'end' + end + end)
  assert.equal(terminal.screen(), 'end')
})

test('markers inside split control strings do not start or end frames', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old' + begin + home + 'new' + '\x1b]title;')
  terminal.write(end + '\x1b')
  terminal.write('\\')
  assert.equal(terminal.screen(), 'old')
  terminal.write(end)
  assert.equal(terminal.screen(), 'new')
})

test('alternate screen transitions inside a frame are atomic', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('primary' + begin + '\x1b[?1049h' + 'alternate')
  assert.equal(terminal.screen(), 'primary')
  terminal.write(end)
  assert.equal(terminal.screen(), 'alternate')
  terminal.write(begin + '\x1b[?1049l')
  assert.equal(terminal.screen(), 'alternate')
  terminal.write(end)
  assert.equal(terminal.screen(), 'primary')
})

test('synchronization can share a private-mode sequence with another mode', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('primary' + '\x1b[?2026;1049h' + 'alternate')
  assert.equal(terminal.screen(), 'primary')
  terminal.write(end)
  assert.equal(terminal.screen(), 'alternate')
  terminal.write(begin + '\x1b[?2026;1049l')
  assert.equal(terminal.screen(), 'primary')
})

test('oversized unfinished frames fail closed permanently', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old' + begin + home + 'new')
  assert.throws(() => terminal.write('\x1b]' + 'x'.repeat(MAX_OUTPUT)), /frame exceeded/)
  assert.throws(() => terminal.screen(), /frame exceeded/)
  assert.throws(() => terminal.write(end), /frame exceeded/)
})

test('parser errors cannot expose a partial frame after the caller catches them', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old' + begin + home + 'new')
  assert.throws(() => terminal.write('\x1b]' + 'x'.repeat(65537)), /Unterminated/)
  assert.throws(() => terminal.screen(), /Unterminated/)
  assert.throws(() => terminal.write(end), /Unterminated/)
})

test('an oversized frame cannot publish even when its end arrives in the same write', () => {
  const terminal = terminalScreen(20, 1)
  terminal.write('old')
  assert.throws(() => terminal.write(begin + home + 'new' + '\x1b]' + 'x'.repeat(MAX_OUTPUT) + '\x07' + end), /frame exceeded/)
  assert.throws(() => terminal.screen(), /frame exceeded/)
})
