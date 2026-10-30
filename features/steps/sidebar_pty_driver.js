/** Test-only real-host sidebar driver. The caller owns setupRoot and pluginPath. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { isEastAsianWide } from './sidebar_east_asian_width.js'
import { createSidebarTemp } from './sidebar_temp_helper.js'
import {
  SUPERVISOR_PATH, MAX_OUTPUT, TIMEOUT_SECONDS, assertNoSystemConfig,
  systemSources, supportedHostVersion, isolatedEnvironment, spawnRealPty,
  connectSupervisor, cleanupSupervisor, createOutputCapture, deferred, withTimeout,
} from './tui_smoke_helper.js'

const COLS = 160
const ROWS = 40
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// A bounded screen model, not a search through historical output. OpenTUI uses
// cursor addressing and overwrites previous frames. Keep escape sequences across
// PTY chunks and ignore formatting while implementing screen-changing controls.
export function terminalScreen(cols, rows) {
  const blank = () => Array(cols).fill(' ')
  let cells = Array.from({ length: rows }, blank)
  let x = 0, y = 0, saved = [0, 0], pending = '', wrap = false
  let primary = null
  let scrollTop = 0, scrollBottom = rows - 1
  let frameDepth = 0, frameSize = 0, completedScreen = null, failure = null
  const render = () => cells.map(line => line.join('').replace(/ +$/, '')).join('\n')
  const checkFrameSize = size => {
    if (size > MAX_OUTPUT) throw new Error('Synchronized terminal frame exceeded the output limit')
  }
  const clamp = (v, max) => Math.max(0, Math.min(max, v))
  const scroll = () => { cells.splice(scrollTop, 1); cells.splice(scrollBottom, 0, blank()) }
  const lineFeed = () => { if (y === scrollBottom) scroll(); else y = clamp(y + 1, rows - 1) }
  const eraseLine = (a, b) => { for (let i = a; i <= b; i++) cells[y][i] = ' ' }
  function csi(raw, final) {
    const privateMode = /^[?>!]/.test(raw)
    const nums = raw.replace(/^[?>!]/, '').split(';').map(v => Number.parseInt(v, 10) || 0)
    const n = nums[0] || 1
    if (privateMode) {
      if ((final === 'h' || final === 'l') && nums.includes(1049)) {
        if (final === 'h' && primary === null) { primary = { cells, x, y }; cells = Array.from({ length: rows }, blank); x = y = 0 }
        else if (final === 'l' && primary !== null) { ({ cells, x, y } = primary); primary = null }
      }
      return
    }
    switch (final) {
      case 'H': case 'f': y = clamp((nums[0] || 1) - 1, rows - 1); x = clamp((nums[1] || 1) - 1, cols - 1); break
      case 'A': y = clamp(y - n, rows - 1); break
      case 'B': case 'e': y = clamp(y + n, rows - 1); break
      case 'C': case 'a': x = clamp(x + n, cols - 1); break
      case 'D': x = clamp(x - n, cols - 1); break
      case 'E': y = clamp(y + n, rows - 1); x = 0; break
      case 'F': y = clamp(y - n, rows - 1); x = 0; break
      case 'G': case '`': x = clamp(n - 1, cols - 1); break
      case 'd': y = clamp(n - 1, rows - 1); break
      case 'J':
        if (nums[0] === 2 || nums[0] === 3) cells = Array.from({ length: rows }, blank)
        else if (nums[0] === 1) { for (let r = 0; r < y; r++) cells[r] = blank(); eraseLine(0, x) }
        else { eraseLine(x, cols - 1); for (let r = y + 1; r < rows; r++) cells[r] = blank() }
        break
      case 'K': if (nums[0] === 2) eraseLine(0, cols - 1); else if (nums[0] === 1) eraseLine(0, x); else eraseLine(x, cols - 1); break
      case 'X': eraseLine(x, Math.min(cols - 1, x + n - 1)); break
      case '@': cells[y].splice(x, 0, ...Array(Math.min(n, cols)).fill(' ')); cells[y].length = cols; break
      case 'P': cells[y].splice(x, n); while (cells[y].length < cols) cells[y].push(' '); break
      case 'L': if (y >= scrollTop && y <= scrollBottom) { for (let i = 0; i < Math.min(n, scrollBottom - y + 1); i++) { cells.splice(scrollBottom, 1); cells.splice(y, 0, blank()) } } break
      case 'M': if (y >= scrollTop && y <= scrollBottom) { for (let i = 0; i < Math.min(n, scrollBottom - y + 1); i++) { cells.splice(y, 1); cells.splice(scrollBottom, 0, blank()) } } break
      case 'S': for (let i = 0; i < Math.min(n, rows); i++) scroll(); break
      case 'r': scrollTop = clamp((nums[0] || 1) - 1, rows - 1); scrollBottom = clamp((nums[1] || rows) - 1, rows - 1); if (scrollTop >= scrollBottom) { scrollTop = 0; scrollBottom = rows - 1 } x = y = 0; break
      case 's': saved = [x, y]; break
      case 'u': [x, y] = saved; break
    }
    if (final !== 'm') wrap = false
  }
  function parse(text) {
    pending += text
    let i = 0
    // Only count consumed input once; an incomplete escape remains in pending
    // and is accounted for separately until the next write completes it.
    let frameStart = frameDepth ? 0 : null
    while (i < pending.length) {
      if (frameDepth) checkFrameSize(frameSize + i - frameStart)
      const c = pending[i]
      if (c === '\x1b') {
        if (i + 1 >= pending.length) break
        const kind = pending[i + 1]
        if (kind === '[') {
          let j = i + 2
          while (j < pending.length && !(pending.charCodeAt(j) >= 0x40 && pending.charCodeAt(j) <= 0x7e)) j++
          if (j === pending.length) break
          const raw = pending.slice(i + 2, j), final = pending[j]
          const sync = raw.startsWith('?') && raw.slice(1).split(';').includes('2026') && (final === 'h' || final === 'l')
          if (sync && final === 'h') {
            if (!frameDepth) { completedScreen = render(); frameSize = 0; frameStart = i }
            frameDepth++
          }
          csi(raw, final)
          i = j + 1
          if (sync && final === 'l' && frameDepth) {
            checkFrameSize(frameSize + i - frameStart)
            if (--frameDepth === 0) { completedScreen = null; frameSize = 0; frameStart = null }
          }
          continue
        }
        if (kind === ']' || kind === 'P' || kind === '_' || kind === '^') {
          let j = i + 2
          while (j < pending.length && pending[j] !== '\x07' && !(pending[j] === '\x1b' && pending[j + 1] === '\\')) j++
          if (j >= pending.length || (pending[j] === '\x1b' && j + 1 >= pending.length)) break
          i = j + (pending[j] === '\x07' ? 1 : 2); continue
        }
        if (kind === '7') saved = [x, y]
        if (kind === '8') [x, y] = saved
        if (kind === 'D') lineFeed()
        if (kind === 'E') { x = 0; lineFeed() }
        if (kind === 'M') { if (y === scrollTop) { cells.splice(scrollBottom, 1); cells.splice(scrollTop, 0, blank()) } else y = clamp(y - 1, rows - 1) }
        // Character-set designation consumes one additional byte.
        if ('()*+'.includes(kind)) { if (i + 2 >= pending.length) break; i += 3 } else i += 2
        wrap = false; continue
      }
      const cp = pending.codePointAt(i)
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 === pending.length) break
      const char = String.fromCodePoint(cp); i += char.length
      if (char === '\r') { x = 0; wrap = false; continue }
      if (char === '\n' || char === '\v' || char === '\f') { lineFeed(); wrap = false; continue }
      if (char === '\b') { x = Math.max(0, x - 1); wrap = false; continue }
      if (char === '\t') { x = Math.min(cols - 1, (Math.floor(x / 8) + 1) * 8); wrap = false; continue }
      if (cp < 32 || cp === 127) continue
      if (/\p{Mark}/u.test(char) || cp === 0xfe0f || cp === 0x200d) { if (x > 0) cells[y][x - 1] += char; continue }
      // Preserve the existing emoji approximation while handling the complete
      // East Asian W/F ranges, including supplementary-plane scripts.
      const wide = isEastAsianWide(cp) || (cp >= 0x1f300 && cp <= 0x1faff)
      if (wrap || (wide && x === cols - 1)) { x = 0; lineFeed(); wrap = false }
      cells[y][x] = char
      if (wide && x + 1 < cols) cells[y][x + 1] = ''
      x += wide ? 2 : 1
      if (x >= cols) { x = cols - 1; wrap = true }
    }
    if (frameDepth) {
      frameSize += i - frameStart
      checkFrameSize(frameSize + pending.length - i)
    }
    pending = pending.slice(i)
    if (pending.length > 65536) throw new Error('Unterminated terminal control sequence')
  }
  function write(text) {
    if (failure) throw failure
    try { parse(text) } catch (error) { failure = error; throw error }
  }
  return {
    write,
    screen: () => { if (failure) throw failure; return frameDepth ? completedScreen : render() },
  }
}

// Both the import and interactive target run under the same authenticated group
// supervisor. Never kill an unanchored PID; fail if cleanup is unconfirmed.
async function supervised(executable, args, cwd, env, socketPath, onData) {
  const terminal = await spawnRealPty(process.execPath, [SUPERVISOR_PATH, socketPath, executable, ...args], { name: 'xterm-256color', cols: COLS, rows: ROWS, cwd, env })
  const ptyExit = new Promise(resolve => terminal.onExit(resolve))
  const captured = createOutputCapture(MAX_OUTPUT)
  let outputError = null, exited = false
  terminal.onData(chunk => { captured.append(chunk); if (outputError) return; if (captured.overflow) outputError = new Error('OpenCode TUI exceeded the output limit'); else { try { onData?.(chunk) } catch (error) { outputError = error } } })
  void ptyExit.then(() => { exited = true })
  const state = { token: null, ready: null, readySignal: deferred(), startedSignal: deferred(), errorSignal: deferred(), cleanupSignal: deferred(), cleanup: null, error: null, targetExit: null, targetExitSignal: deferred() }
  let ipc = null
  let closing
  const close = () => closing ??= (async () => {
    try { await cleanupSupervisor({ ipc, ptyExit, state, graceMs: 5000 }) }
    finally { ipc?.close() }
  })()
  const healthy = () => {
    if (outputError) throw outputError
    if (state.error) throw new Error(`OpenCode supervisor: ${state.error}`)
    if (exited) throw new Error('OpenCode supervisor exited unexpectedly')
  }
  try {
    ipc = await connectSupervisor(socketPath, { timeoutMs: 5000 })
    ipc.onMessage(message => {
      if (message?.type === 'ready') { state.ready = message; state.readySignal.resolve() }
      else if (message?.type === 'target-start') state.startedSignal.resolve()
      else if (message?.type === 'target-exit') { state.targetExit = message; state.targetExitSignal.resolve() }
      else if (message?.type === 'error') { state.error = message.message ?? 'unknown error'; state.errorSignal.resolve() }
      else if (message?.type === 'clean' || message?.type === 'killing') { state.cleanup = message.type; state.cleanupSignal.resolve() }
    })
    const ready = await withTimeout(state.readySignal.promise.then(() => state.ready), 5000, 'Supervisor handshake timed out')
    if (ready.protocol !== 2 || ready.pid !== terminal.pid || typeof ready.token !== 'string' || ready.token.length < 32) throw new Error('Invalid supervisor handshake')
    state.token = ready.token
    ipc.send({ type: 'start', token: ready.token })
    await withTimeout(Promise.race([state.startedSignal.promise, state.errorSignal.promise.then(() => { throw new Error(`Supervisor rejected start: ${state.error}`) })]), 5000, 'Supervisor start timed out')
    healthy()
    return { terminal, state, healthy, close, captured }
  } catch (error) {
    try { await close() } catch (cleanupError) { error.cause ??= cleanupError }
    throw error
  }
}

/**
 * Launch a pinned OpenCode TUI with a synthetic, imported root session.
 * screen() returns the current 160x40 screen as newline-separated text;
 * send() writes raw terminal input (including SGR mouse sequences). waitFor()
 * calls its predicate with that screen until truthy, or rejects after 30s.
 * Always await close(); unconfirmed cleanup fails and retains the private tree.
 */
export async function startSidebarPty({ pluginPath, sessionID, setupRoot, sessionIDs = [sessionID] }) {
  if (!path.isAbsolute(pluginPath) || !path.isAbsolute(setupRoot) || !Array.isArray(sessionIDs) || !sessionIDs.includes(sessionID) || sessionIDs.some(id => typeof id !== 'string' || !/^ses_[A-Za-z0-9_-]+$/.test(id))) throw new Error('Expected absolute pluginPath and setupRoot and valid session IDs')
  const executable = process.env.OATS_OPENCODE ?? 'opencode'
  await supportedHostVersion(executable)
  assertNoSystemConfig(systemSources())
  const root = await createSidebarTemp('oats-sidebar-')
  let active = null, safeToRemove = true
  try {
    const project = path.join(root, 'project')
    await fs.mkdir(project)
    const env = { ...isolatedEnvironment(root, [pluginPath]), TMPDIR: root, XDG_RUNTIME_DIR: root }
    const fixture = path.join(root, 'session.json')
    for (const id of new Set(sessionIDs)) {
      await fs.writeFile(fixture, JSON.stringify({ info: { id, projectID: 'sidebar-test', title: 'Sidebar test', agent: 'sidebar-test', model: { providerID: 'sidebar-test', id: 'sidebar-test' }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, time: { created: Date.now(), updated: Date.now() }, location: { directory: project } }, messages: [] }))
      safeToRemove = false
      active = await supervised(executable, ['session', 'import', '--standalone', '--directory', project, fixture], project, env, path.join(root, 'import.sock'))
      try {
        await withTimeout(active.state.targetExitSignal.promise, TIMEOUT_SECONDS * 1000, 'Session import timed out')
        active.healthy()
        if (active.state.targetExit.exitCode !== 0 || active.state.targetExit.signal || active.state.targetExit.error) throw new Error(`Session import failed: ${active.captured.text}`)
      } finally { await active.close(); safeToRemove = true; active = null }
    }
    const screen = terminalScreen(COLS, ROWS)
    safeToRemove = false
    active = await supervised(executable, ['--standalone', '--session', sessionID, project], project, env, path.join(root, 'tui.sock'), chunk => screen.write(chunk))
    let closed = false, closePromise
    return {
      screen: () => { active.healthy(); return screen.screen() },
      send: input => { active.healthy(); if (closed || active.state.targetExit) throw new Error('OpenCode TUI is not running'); if (typeof input !== 'string') throw new TypeError('Terminal input must be a string'); active.terminal.write(input) },
      waitFor: async predicate => {
        const deadline = Date.now() + TIMEOUT_SECONDS * 1000
        while (Date.now() < deadline) {
          active.healthy()
          if (closed || active.state.targetExit) throw new Error(`OpenCode TUI exited before predicate matched\n${screen.screen()}`)
          const value = predicate(screen.screen())
          if (value) return value
          await delay(50)
        }
        throw new Error(`Timed out waiting for OpenCode TUI screen\n${screen.screen()}`)
      },
      close: () => closePromise ??= (async () => { closed = true; await active.close(); safeToRemove = true; await fs.rm(root, { recursive: true, force: true }) })(),
    }
  } catch (error) {
    if (active) { try { await active.close(); safeToRemove = true } catch (cleanupError) { error.cause ??= cleanupError } }
    if (safeToRemove) await fs.rm(root, { recursive: true, force: true })
    else error.message += `; cleanup unconfirmed, retained ${root}`
    throw error
  }
}
