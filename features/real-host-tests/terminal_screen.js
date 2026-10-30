// A bounded terminal screen model for observing the real OpenCode TUI.
//
// OpenTUI writes cursor-addressed frames with synchronized-output markers, not
// plain lines. Searching raw PTY output would let text from an earlier frame
// satisfy an assertion, so this model applies only screen-changing controls and
// exposes the current grid. It intentionally does not model colors, attributes,
// or the primary/alternate screen contents beyond clearing and restoring them.
//
// Only the controls OpenTUI uses are implemented. Unknown CSI sequences are
// ignored, which is safe for this observation because they do not move or erase
// text. A pending escape sequence is retained across PTY chunks.

const MAX_PENDING = 64 * 1024

// Unicode East Asian Width W and F ranges, sorted by start. Generated from
// the Unicode data shipped with get-east-asian-width 1.7.0 and kept local so
// the real-host observer has no runtime dependency on a transitive package.
// The upstream copyright and permission notice is reproduced in
// features/THIRD_PARTY_NOTICES.md.
// Refresh this table when advancing the supported host/Unicode data.
const EAST_ASIAN_WIDE_RANGES = [
  [0x1100, 0x115f],
  [0x231a, 0x231b],
  [0x2329, 0x232a],
  [0x23e9, 0x23ec],
  [0x23f0, 0x23f0],
  [0x23f3, 0x23f3],
  [0x25fd, 0x25fe],
  [0x2614, 0x2615],
  [0x2630, 0x2637],
  [0x2648, 0x2653],
  [0x267f, 0x267f],
  [0x268a, 0x268f],
  [0x2693, 0x2693],
  [0x26a1, 0x26a1],
  [0x26aa, 0x26ab],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26ce, 0x26ce],
  [0x26d4, 0x26d4],
  [0x26ea, 0x26ea],
  [0x26f2, 0x26f3],
  [0x26f5, 0x26f5],
  [0x26fa, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2705, 0x2705],
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2795, 0x2797],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0x2e99],
  [0x2e9b, 0x2ef3],
  [0x2f00, 0x2fd5],
  [0x2ff0, 0x2fff],
  [0x3000, 0x3000],
  [0x3001, 0x303e],
  [0x3041, 0x3096],
  [0x3099, 0x30ff],
  [0x3105, 0x312f],
  [0x3131, 0x318e],
  [0x3190, 0x31e5],
  [0x31ef, 0x321e],
  [0x3220, 0x3247],
  [0x3250, 0xa48c],
  [0xa490, 0xa4c6],
  [0xa960, 0xa97c],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe52],
  [0xfe54, 0xfe66],
  [0xfe68, 0xfe6b],
  [0xff01, 0xff60],
  [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4],
  [0x16ff0, 0x16ff6],
  [0x17000, 0x18cda],
  [0x18cff, 0x18d20],
  [0x18d80, 0x18df2],
  [0x18e00, 0x19191],
  [0x191a0, 0x191d2],
  [0x1aff0, 0x1aff3],
  [0x1aff5, 0x1affb],
  [0x1affd, 0x1affe],
  [0x1b000, 0x1b128],
  [0x1b132, 0x1b132],
  [0x1b150, 0x1b152],
  [0x1b155, 0x1b155],
  [0x1b164, 0x1b168],
  [0x1b170, 0x1b2fb],
  [0x1d300, 0x1d356],
  [0x1d360, 0x1d376],
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f1ae, 0x1f1ae],
  [0x1f200, 0x1f202],
  [0x1f210, 0x1f23b],
  [0x1f240, 0x1f248],
  [0x1f250, 0x1f251],
  [0x1f260, 0x1f265],
  [0x1f300, 0x1f320],
  [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393],
  [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e],
  [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d],
  [0x1f54b, 0x1f54e],
  [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2],
  [0x1f6d5, 0x1f6d9],
  [0x1f6dc, 0x1f6df],
  [0x1f6eb, 0x1f6ec],
  [0x1f6f4, 0x1f6fc],
  [0x1f7da, 0x1f7da],
  [0x1f7e0, 0x1f7eb],
  [0x1f7f0, 0x1f7f0],
  [0x1f90c, 0x1f93a],
  [0x1f93c, 0x1f945],
  [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1fa7c],
  [0x1fa80, 0x1fac6],
  [0x1fac8, 0x1fac8],
  [0x1facc, 0x1fadd],
  [0x1fadf, 0x1faeb],
  [0x1faef, 0x1fafa],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
]

function isWide(codePoint) {
  let low = 0
  let high = EAST_ASIAN_WIDE_RANGES.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const [start, end] = EAST_ASIAN_WIDE_RANGES[middle]
    if (codePoint < start) high = middle - 1
    else if (codePoint > end) low = middle + 1
    else return true
  }
  return false
}

function isCombining(char, codePoint) {
  return /\p{Mark}/u.test(char) || codePoint === 0xfe0f || codePoint === 0x200d
}

export function displayWidth(text) {
  let width = 0
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    if (isCombining(char, codePoint)) continue
    width += isWide(codePoint) ? 2 : 1
  }
  return width
}

/**
 * @param {number} cols
 * @param {number} rows
 */
export function createTerminalScreen(cols, rows) {
  const blank = () => Array(cols).fill(' ')
  let cells = Array.from({ length: rows }, blank)
  let x = 0
  let y = 0
  let saved = [0, 0]
  let pending = ''
  let wrap = false
  let primary = null
  let synchronized = null
  let scrollTop = 0
  let scrollBottom = rows - 1

  const clamp = (value, max) => Math.max(0, Math.min(max, value))
  const blankLine = () => blank()
  const scroll = () => {
    cells.splice(scrollTop, 1)
    cells.splice(scrollBottom, 0, blankLine())
  }
  const lineFeed = () => {
    if (y === scrollBottom) scroll()
    else y = clamp(y + 1, rows - 1)
  }
  const eraseLine = (from, to) => {
    for (let column = from; column <= to; column += 1) cells[y][column] = ' '
  }

  function csi(raw, final) {
    const privateMode = /^[?>!]/.test(raw)
    const numbers = raw.replace(/^[?>!]/, '').split(';').map(value => Number.parseInt(value, 10) || 0)
    const count = numbers[0] || 1
    if (privateMode) {
      if (final === 'h' || final === 'l') {
        if (numbers.includes(1049)) {
          if (final === 'h' && primary === null) {
            primary = { cells, x, y }
            cells = Array.from({ length: rows }, blankLine)
            x = 0
            y = 0
          } else if (final === 'l' && primary !== null) {
            ({ cells, x, y } = primary)
            primary = null
          }
        }
        if (numbers.includes(2026)) {
          // Synchronized output: do not expose a partially updated frame. The
          // host wraps every rendered frame in these markers.
          if (final === 'h' && synchronized === null) {
            synchronized = cells.map(line => line.slice())
          } else if (final === 'l') {
            synchronized = null
          }
        }
      }
      return
    }
    switch (final) {
      case 'H':
      case 'f':
        y = clamp((numbers[0] || 1) - 1, rows - 1)
        x = clamp((numbers[1] || 1) - 1, cols - 1)
        break
      case 'A': y = clamp(y - count, rows - 1); break
      case 'B':
      case 'e': y = clamp(y + count, rows - 1); break
      case 'C':
      case 'a': x = clamp(x + count, cols - 1); break
      case 'D': x = clamp(x - count, cols - 1); break
      case 'E': y = clamp(y + count, rows - 1); x = 0; break
      case 'F': y = clamp(y - count, rows - 1); x = 0; break
      case 'G':
      case '`': x = clamp(count - 1, cols - 1); break
      case 'd': y = clamp(count - 1, rows - 1); break
      case 'J':
        if (numbers[0] === 2 || numbers[0] === 3) cells = Array.from({ length: rows }, blankLine)
        else if (numbers[0] === 1) {
          for (let row = 0; row < y; row += 1) cells[row] = blankLine()
          eraseLine(0, x)
        } else {
          eraseLine(x, cols - 1)
          for (let row = y + 1; row < rows; row += 1) cells[row] = blankLine()
        }
        break
      case 'K':
        if (numbers[0] === 2) eraseLine(0, cols - 1)
        else if (numbers[0] === 1) eraseLine(0, x)
        else eraseLine(x, cols - 1)
        break
      case 'X': eraseLine(x, Math.min(cols - 1, x + count - 1)); break
      case '@':
        cells[y].splice(x, 0, ...Array(Math.min(count, cols)).fill(' '))
        cells[y].length = cols
        break
      case 'P':
        cells[y].splice(x, count)
        while (cells[y].length < cols) cells[y].push(' ')
        break
      case 'L':
        if (y >= scrollTop && y <= scrollBottom) {
          for (let index = 0; index < Math.min(count, scrollBottom - y + 1); index += 1) {
            cells.splice(scrollBottom, 1)
            cells.splice(y, 0, blankLine())
          }
        }
        break
      case 'M':
        if (y >= scrollTop && y <= scrollBottom) {
          for (let index = 0; index < Math.min(count, scrollBottom - y + 1); index += 1) {
            cells.splice(y, 1)
            cells.splice(scrollBottom, 0, blankLine())
          }
        }
        break
      case 'S':
        for (let index = 0; index < Math.min(count, rows); index += 1) scroll()
        break
      case 'r':
        scrollTop = clamp((numbers[0] || 1) - 1, rows - 1)
        scrollBottom = clamp((numbers[1] || rows) - 1, rows - 1)
        if (scrollTop >= scrollBottom) {
          scrollTop = 0
          scrollBottom = rows - 1
        }
        x = 0
        y = 0
        break
      case 's': saved = [x, y]; break
      case 'u': [x, y] = saved; break
      default:
        break
    }
    if (final !== 'm') wrap = false
  }

  function write(text) {
    pending += text
    let index = 0
    while (index < pending.length) {
      const char = pending[index]
      if (char === '\x1b') {
        if (index + 1 >= pending.length) break
        const kind = pending[index + 1]
        if (kind === '[') {
          let end = index + 2
          while (end < pending.length) {
            const code = pending.charCodeAt(end)
            if (code >= 0x40 && code <= 0x7e) break
            end += 1
          }
          if (end === pending.length) break
          csi(pending.slice(index + 2, end), pending[end])
          index = end + 1
          continue
        }
        if (kind === ']' || kind === 'P' || kind === '_' || kind === '^') {
          let end = index + 2
          while (end < pending.length && pending[end] !== '\x07' &&
            !(pending[end] === '\x1b' && pending[end + 1] === '\\')) {
            end += 1
          }
          if (end >= pending.length || (pending[end] === '\x1b' && end + 1 >= pending.length)) break
          index = end + (pending[end] === '\x07' ? 1 : 2)
          continue
        }
        if (kind === '7') saved = [x, y]
        if (kind === '8') [x, y] = saved
        if (kind === 'D') lineFeed()
        if (kind === 'E') {
          x = 0
          lineFeed()
        }
        if (kind === 'M') {
          if (y === scrollTop) {
            cells.splice(scrollBottom, 1)
            cells.splice(scrollTop, 0, blankLine())
          } else {
            y = clamp(y - 1, rows - 1)
          }
        }
        if ('()*+'.includes(kind)) {
          if (index + 2 >= pending.length) break
          index += 3
        } else {
          index += 2
        }
        wrap = false
        continue
      }

      const codePoint = pending.codePointAt(index)
      if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 === pending.length) break
      const character = String.fromCodePoint(codePoint)
      index += character.length

      if (character === '\r') {
        x = 0
        wrap = false
        continue
      }
      if (character === '\n' || character === '\v' || character === '\f') {
        lineFeed()
        wrap = false
        continue
      }
      if (character === '\b') {
        x = Math.max(0, x - 1)
        wrap = false
        continue
      }
      if (character === '\t') {
        x = Math.min(cols - 1, (Math.floor(x / 8) + 1) * 8)
        wrap = false
        continue
      }
      if (codePoint < 32 || codePoint === 127) continue

      if (isCombining(character, codePoint)) {
        if (x > 0) cells[y][x - 1] += character
        continue
      }

      const wide = isWide(codePoint)
      if (wrap || (wide && x === cols - 1)) {
        x = 0
        lineFeed()
        wrap = false
      }
      cells[y][x] = character
      if (wide && x + 1 < cols) cells[y][x + 1] = ''
      x += wide ? 2 : 1
      if (x >= cols) {
        x = cols - 1
        wrap = true
      }
    }
    pending = pending.slice(index)
    if (pending.length > MAX_PENDING) throw new Error('Unterminated terminal control sequence')
  }

  return {
    write,
    screen: () => (synchronized ?? cells)
      .map(line => line.join('').replace(/ +$/, ''))
      .join('\n'),
  }
}

/**
 * Find the 1-based terminal cell at the start of `needle` plus `offset`.
 * Returns undefined when the text is not currently on screen.
 */
export function findTextCell(screenText, needle, offset = 0) {
  const lines = screenText.split('\n')
  for (let row = 0; row < lines.length; row += 1) {
    const index = lines[row].indexOf(needle)
    if (index >= 0) {
      return {
        row: row + 1,
        column: displayWidth(lines[row].slice(0, index)) + 1 + offset,
      }
    }
  }
  return undefined
}

export function clickAt(cell) {
  return `\x1b[<0;${cell.column};${cell.row}M\x1b[<0;${cell.column};${cell.row}m`
}
