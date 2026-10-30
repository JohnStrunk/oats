// Real OpenCode TUI observation harness for the Agent stats sidebar.
//
// The TUI runs on a real PTY under the repository's persistent group-leader
// supervisor, connects to the caller's authenticated local server, and opens a
// synthetic imported root session. The harness exposes the current rendered
// screen (not a search through every historical frame), raw input delivery for
// mouse/keyboard interaction, and fail-closed cleanup.

import { randomBytes } from 'node:crypto'
import { SUPERVISOR_PATH, connectSupervisor } from '../steps/tui_smoke_helper.js'
import { clickAt, createTerminalScreen, findTextCell } from './terminal_screen.js'

const SUPERVISOR_PROTOCOL = 2
const SUPERVISOR_TOKEN_MIN_LENGTH = 32
const SUPERVISOR_CONNECT_TIMEOUT_MS = 5_000
const SUPERVISOR_START_TIMEOUT_MS = 10_000
const SUPERVISOR_CLEANUP_TIMEOUT_MS = 5_000
const SUPERVISOR_MAX_GRACE_MS = 5_000
const PTY_CLOSE_TIMEOUT_MS = 10_000
const IPC_DRAIN_MS = 200
const OUTPUT_LIMIT_MESSAGE = 'OpenCode TUI exceeded the output limit'
const MAX_OUTPUT = 4 * 1024 * 1024
const DEFAULT_COLS = 160
const DEFAULT_ROWS = 45
const DEFAULT_TIMEOUT_MS = 30_000

const NODE_PTY_URL = new URL('../../node_modules/node-pty/lib/index.js', import.meta.url)

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function deferred() {
  let resolve
  const promise = new Promise(settle => { resolve = settle })
  return { promise, resolve }
}

function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function createOutputCapture(maxOutput = MAX_OUTPUT) {
  let text = ''
  let bytes = 0
  let overflow = false
  return {
    append(chunk) {
      if (overflow) return
      const chunkBytes = Buffer.byteLength(chunk, 'utf8')
      if (bytes + chunkBytes > maxOutput) {
        overflow = true
        return
      }
      text += chunk
      bytes += chunkBytes
    },
    get text() { return text },
    get bytes() { return bytes },
    get overflow() { return overflow },
  }
}

async function spawnPty(file, args, options) {
  const nodePty = await import(NODE_PTY_URL.href)
  const pty = nodePty.default ?? nodePty
  return pty.spawn(file, args, options)
}

function boundedGrace(value) {
  const requested = Number(value)
  if (!Number.isFinite(requested)) return SUPERVISOR_MAX_GRACE_MS
  return Math.min(Math.max(requested, 0), SUPERVISOR_MAX_GRACE_MS)
}

async function closeSupervisor({ ipc, ptyExit, state, graceMs }) {
  if (!ipc || typeof state.token !== 'string') {
    try { ipc?.close() } catch {}
    await withTimeout(ptyExit, 20_000, 'PTY supervisor did not close after IPC failure').catch(() => {})
    throw new Error('OpenCode TUI supervisor control channel unavailable; cleanup cannot be confirmed')
  }

  try {
    ipc.send({ type: 'shutdown', token: state.token, graceMs })
  } catch (error) {
    throw new Error(`OpenCode TUI supervisor shutdown request failed: ${error.message}`, { cause: error })
  }

  const outcome = await Promise.race([
    state.cleanupSignal.promise.then(() => 'reported'),
    state.errorSignal.promise.then(() => 'error'),
    ptyExit.then(() => 'pty-exit'),
    delay(graceMs + SUPERVISOR_CLEANUP_TIMEOUT_MS).then(() => 'timeout'),
  ])
  if (state.error) {
    throw new Error(`OpenCode TUI supervisor rejected control request: ${state.error}`)
  }
  if (outcome === 'timeout') {
    throw new Error('OpenCode TUI supervisor did not confirm cleanup before timeout')
  }

  const status = await withTimeout(
    ptyExit,
    PTY_CLOSE_TIMEOUT_MS,
    'PTY supervisor did not close after cleanup',
  )
  if (state.cleanup === null) {
    await Promise.race([
      state.cleanupSignal.promise,
      state.errorSignal.promise,
      delay(IPC_DRAIN_MS),
    ])
  }
  if (state.error) {
    throw new Error(`OpenCode TUI supervisor rejected control request: ${state.error}`)
  }
  if (state.cleanup === 'killing') {
    throw new Error('OpenCode TUI cleanup escalated to SIGKILL; group termination cannot be confirmed')
  }
  if (state.cleanup !== 'clean') {
    throw new Error('OpenCode TUI supervisor exited without confirming descendant cleanup')
  }
  if (status?.exitCode !== 0 || status?.signal) {
    throw new Error(
      `OpenCode TUI supervisor reported clean cleanup but exited with code ${status?.exitCode} signal ${status?.signal}`,
    )
  }
}

function tuiEnvironment(server, pluginPath) {
  return {
    ...server.env,
    OPENCODE_SERVER_PASSWORD: server.password,
    OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({
      plugins: pluginPath ? [pluginPath] : [],
      highlights: false,
    }),
  }
}

/**
 * @param {object} options
 * @param {string} options.executable Absolute pinned OpenCode executable.
 * @param {object} options.server Fixture returned by startSidebarServer().
 * @param {string|null} options.pluginPath Plugin package to configure, or null
 *   for the negative control.
 */
export async function startSidebarTui({
  executable,
  server,
  pluginPath,
  cols = DEFAULT_COLS,
  rows = DEFAULT_ROWS,
  harness = {},
}) {
  const spawnTui = harness.spawnPty ?? spawnPty
  const cleanupTui = harness.closeSupervisor ?? closeSupervisor
  const env = tuiEnvironment(server, pluginPath)
  const socketPath = server.root +
    `/tui-supervisor-${Date.now()}-${process.pid}-${randomBytes(4).toString('hex')}.sock`
  const capture = createOutputCapture()
  const screen = createTerminalScreen(cols, rows)
  let outputError = null
  let terminal = null
  let ptyExit = Promise.resolve({})
  let supervisorExited = false

  const state = {
    token: null,
    ready: null,
    readySignal: deferred(),
    startedSignal: deferred(),
    errorSignal: deferred(),
    cleanupSignal: deferred(),
    cleanup: null,
    error: null,
    targetExit: null,
  }
  let ipc = null
  let closed = false
  let closePromise

  const healthy = () => {
    if (outputError) throw outputError
    if (state.error) throw new Error(`OpenCode TUI supervisor: ${state.error}`)
    if (supervisorExited) throw new Error('OpenCode TUI supervisor exited unexpectedly')
    if (state.targetExit) {
      const { exitCode, signal, error } = state.targetExit
      throw new Error(
        `OpenCode TUI exited before the assertion completed (code ${exitCode ?? 'null'} ` +
          `signal ${signal ?? 'null'}${error ? ` error ${error}` : ''})`,
      )
    }
  }

  const close = () => closePromise ??= (async () => {
    closed = true
    try {
      await cleanupTui({ ipc, ptyExit, state, graceMs: boundedGrace(5_000) })
    } finally {
      try { ipc?.close() } catch {}
    }
  })()

  try {
    terminal = await spawnTui(
      process.execPath,
      [
        SUPERVISOR_PATH,
        socketPath,
        executable,
        '--server',
        server.baseUrl,
        '--session',
        server.sessions.sessionID,
      ],
      { name: 'xterm-256color', cols, rows, cwd: server.dirs.project, env },
    )
    ptyExit = new Promise(resolve => terminal.onExit(status => resolve(status ?? {})))
    void ptyExit.then(() => { supervisorExited = true })

    terminal.onData(chunk => {
      capture.append(chunk)
      if (capture.overflow) {
        outputError = new Error(OUTPUT_LIMIT_MESSAGE)
        return
      }
      try {
        screen.write(chunk)
      } catch (error) {
        outputError = error
      }
    })

    ipc = await connectSupervisor(socketPath, { timeoutMs: SUPERVISOR_CONNECT_TIMEOUT_MS })
    ipc.onMessage(message => {
      if (message?.type === 'ready') {
        state.ready = message
        state.readySignal.resolve()
      } else if (message?.type === 'target-start') {
        state.startedSignal.resolve()
      } else if (message?.type === 'target-exit') {
        state.targetExit = message
      } else if (message?.type === 'error') {
        state.error = message.message ?? 'unspecified supervisor error'
        state.errorSignal.resolve()
      } else if (message?.type === 'clean' || message?.type === 'killing') {
        state.cleanup = message.type
        state.cleanupSignal.resolve()
      }
    })

    const ready = await withTimeout(
      state.readySignal.promise.then(() => state.ready),
      SUPERVISOR_CONNECT_TIMEOUT_MS,
      'OpenCode TUI supervisor did not complete its control handshake',
    )
    if (
      ready?.protocol !== SUPERVISOR_PROTOCOL ||
      ready.pid !== terminal.pid ||
      typeof ready.token !== 'string' ||
      ready.token.length < SUPERVISOR_TOKEN_MIN_LENGTH
    ) {
      throw new Error('OpenCode TUI supervisor control handshake was invalid')
    }
    state.token = ready.token
    ipc.send({ type: 'start', token: state.token })
    await withTimeout(
      Promise.race([
        state.startedSignal.promise,
        state.errorSignal.promise.then(() => {
          throw new Error(`OpenCode TUI supervisor rejected start: ${state.error}`)
        }),
      ]),
      SUPERVISOR_START_TIMEOUT_MS,
      'OpenCode TUI supervisor did not start the target',
    )

    const send = input => {
      if (typeof input !== 'string') throw new TypeError('Terminal input must be a string')
      if (closed) throw new Error('OpenCode TUI harness is closed')
      healthy()
      terminal.write(input)
    }

    return {
      screen: () => {
        healthy()
        return screen.screen()
      },
      /**
       * Deliver raw terminal input. Mouse clicks use SGR 1006 encoding.
       */
      send,
      /**
       * Click the first visible occurrence of `text` (plus an optional cell
       * offset) using the screen coordinates where it was actually rendered.
       */
      click(text, offset = 0) {
        const current = screen.screen()
        const cell = findTextCell(current, text, offset)
        if (!cell) {
          throw new Error(`Cannot click "${text}"; it is not on the current screen\n${current}`)
        }
        send(clickAt(cell))
        return cell
      },
      /**
       * Poll the current screen until `predicate` returns a truthy value.
       * Returns that value, or throws with the final screen on timeout.
       */
      async waitFor(predicate, label = 'screen condition', timeoutMs = DEFAULT_TIMEOUT_MS) {
        const deadline = Date.now() + timeoutMs
        while (Date.now() < deadline) {
          healthy()
          const current = screen.screen()
          const value = predicate(current)
          if (value) return value
          await delay(50)
        }
        healthy()
        throw new Error(`Timed out waiting for ${label}\n${screen.screen()}`)
      },
      /** Observe that `text` stays absent for the full window. */
      async assertAbsentFor(text, durationMs = 4_000) {
        const deadline = Date.now() + durationMs
        while (Date.now() < deadline) {
          healthy()
          const current = screen.screen()
          if (current.includes(text)) {
            throw new Error(`Unexpected "${text}" on the current screen\n${current}`)
          }
          await delay(50)
        }
        healthy()
      },
      close,
    }
  } catch (error) {
    let cleanupError
    try {
      await close()
    } catch (caught) {
      cleanupError = caught
    }
    if (cleanupError) {
      // No TUI handle escaped to the caller, so the shared server fixture must
      // be told not to delete its root: an unconfirmed child cleanup means the
      // private tree may still be under a live process.
      error.cleanupUnconfirmed = true
      server.retainRoot?.()
      error.message = `${error.message}; cleanup also failed: ${cleanupError.message}`
    }
    throw error
  }

}
