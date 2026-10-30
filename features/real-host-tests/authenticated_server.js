// Isolated, authenticated OpenCode server for real-host sidebar verification.
//
// The server is started through the repository's persistent process-group
// supervisor so cleanup is anchored and reported. Synthetic sessions are
// imported through the real v2 HTTP client; no model call is made. The caller
// owns the returned root and must await close(). If cleanup cannot be
// confirmed, close() throws and intentionally retains the private tree for
// diagnosis instead of deleting data under a possibly-live process.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { SUPERVISOR_PATH, connectSupervisor } from '../steps/tui_smoke_helper.js'
import { createTempDir } from './temp_root.js'

const SUPERVISOR_PROTOCOL = 2
const SUPERVISOR_TOKEN_MIN_LENGTH = 32
const SUPERVISOR_CONNECT_TIMEOUT_MS = 5_000
const SUPERVISOR_START_TIMEOUT_MS = 10_000
const SUPERVISOR_CLEANUP_TIMEOUT_MS = 15_000
const SUPERVISOR_GRACE_MS = 5_000
const SERVER_LISTEN_TIMEOUT_MS = 20_000
const MAX_SERVER_OUTPUT = 1024 * 1024

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function describeExit(value) {
  if (!value) return 'unknown'
  if (value.error) return `error ${value.error}`
  return `code ${value.status ?? 'null'} signal ${value.signal ?? 'null'}`
}

function assertServerHealthy(state) {
  if (state.spawnError) throw new Error(`OpenCode server failed to start: ${state.spawnError.message}`)
  if (state.protocolError) throw new Error(`OpenCode server supervisor rejected control: ${state.protocolError}`)
  if (state.exit) throw new Error(`OpenCode server supervisor exited early (${describeExit(state.exit)})`)
  if (state.closed) throw new Error('OpenCode server supervisor control channel closed early')
  if (state.targetExit) throw new Error(`OpenCode server exited early (${describeExit(state.targetExit)})`)
}

async function waitForServerState(predicate, timeoutMs, label, state) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    assertServerHealthy(state)
    const value = predicate()
    if (value) return value
    await delay(50)
  }
  assertServerHealthy(state)
  throw new Error(`Timed out waiting for ${label}`)
}

function createOutputCapture(limit = MAX_SERVER_OUTPUT) {
  const state = { text: '', bytes: 0, overflow: false }
  return {
    append(chunk) {
      if (state.overflow) return
      const bytes = Buffer.byteLength(chunk)
      if (state.bytes + bytes > limit) {
        state.overflow = true
        return
      }
      state.bytes += bytes
      state.text += chunk
    },
    get text() { return state.text },
    get overflow() { return state.overflow },
  }
}

function attachOutput(stream, capture) {
  stream.setEncoding('utf8')
  stream.on('data', chunk => capture.append(chunk))
}

/**
 * Whether a server fixture may delete its private root. A root must be kept
 * when cleanup is unconfirmed or when a child harness explicitly retained it.
 */
export function shouldRemoveRoot({ retain = false, retained = false, confirmed = false, hasSupervisor = true } = {}) {
  return !retain && !retained && (confirmed || !hasSupervisor)
}

function createServerCleanup(state, ipcRef, lifecycle) {
  let cleanupPromise
  return () => {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      const ipc = ipcRef.current
      if (ipc && state.ready && state.cleanup == null) {
        try {
          ipc.send({ type: 'shutdown', token: state.ready.token, graceMs: SUPERVISOR_GRACE_MS })
        } catch {
          // Closing the control channel still lets a live supervisor clean its
          // group, but the outcome below cannot be reported as confirmed.
        }
      } else {
        try { ipc?.close() } catch {}
      }

      const deadline = Date.now() + SUPERVISOR_CLEANUP_TIMEOUT_MS
      while (Date.now() < deadline && !(state.exit && state.closed)) await delay(50)
      try { ipc?.close() } catch {}

      if (
        state.cleanup === 'clean' &&
        !state.protocolError &&
        !state.spawnError &&
        state.exit?.status === 0 &&
        state.exit?.signal == null &&
        state.closed
      ) {
        lifecycle.confirmed = true
        return
      }

      const detail = state.cleanup === 'killing'
        ? 'supervisor escalated to SIGKILL'
        : state.cleanup == null
          ? `no cleanup report, ${describeExit(state.exit)}`
          : `cleanup report ${state.cleanup}, ${describeExit(state.exit)}`
      throw new Error(
        `OpenCode server cleanup unconfirmed (${detail}); temporary data retained at ${lifecycle.root}`,
      )
    })()
    return cleanupPromise
  }
}

export function createIsolatedRoot(prefix = 'oats-sidebar-real-host-', options = {}) {
  const root = createTempDir(prefix, options)
  const dirs = Object.fromEntries(
    ['home', 'config', 'data', 'cache', 'state', 'runtime', 'tmp', 'project']
      .map(name => [name, join(root, name)]),
  )
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true, mode: 0o700 })
  return {
    root,
    dirs,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LC_ALL: 'C.UTF-8',
      HOME: dirs.home,
      TMPDIR: dirs.tmp,
      XDG_CONFIG_HOME: dirs.config,
      XDG_DATA_HOME: dirs.data,
      XDG_CACHE_HOME: dirs.cache,
      XDG_STATE_HOME: dirs.state,
      XDG_RUNTIME_DIR: dirs.runtime,
      OPENCODE_DISABLE_PROJECT_CONFIG: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
    },
  }
}

async function startSupervisedServer(executable, env, project, lifecycle) {
  const password = randomBytes(32).toString('base64url')
  const socketPath = join(lifecycle.root, 'server-supervisor.sock')
  const supervisor = spawn(
    process.execPath,
    [SUPERVISOR_PATH, socketPath, executable, 'serve', '--hostname', '127.0.0.1', '--port', '0'],
    {
      cwd: project,
      env: {
        ...env,
        OPENCODE_SERVER_PASSWORD: password,
        OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ plugins: [], highlights: false }),
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  lifecycle.supervisor = supervisor

  const state = {
    ready: null,
    targetStart: null,
    targetExit: null,
    cleanup: null,
    protocolError: null,
    exit: null,
    closed: false,
    spawnError: null,
  }
  const ipcRef = { current: null }
  const cleanup = createServerCleanup(state, ipcRef, lifecycle)
  lifecycle.cleanup = cleanup

  const output = createOutputCapture()
  attachOutput(supervisor.stdout, output)
  attachOutput(supervisor.stderr, output)
  supervisor.on('error', error => { state.spawnError = error })
  supervisor.on('exit', (status, signal) => { state.exit = { status, signal } })
  supervisor.on('close', () => { state.closed = true })

  try {
    const ipc = await connectSupervisor(socketPath, { timeoutMs: SUPERVISOR_CONNECT_TIMEOUT_MS })
    ipcRef.current = ipc
    ipc.onMessage(message => {
      if (message?.type === 'ready') state.ready = message
      if (message?.type === 'target-start') state.targetStart = message
      if (message?.type === 'target-exit') state.targetExit = message
      if (message?.type === 'clean' || message?.type === 'killing') state.cleanup = message.type
      if (message?.type === 'error') state.protocolError = message.message
    })

    const ready = await waitForServerState(
      () => state.ready,
      SUPERVISOR_START_TIMEOUT_MS,
      'server supervisor handshake',
      state,
    )
    if (
      ready.protocol !== SUPERVISOR_PROTOCOL ||
      ready.pid !== supervisor.pid ||
      typeof ready.token !== 'string' ||
      ready.token.length < SUPERVISOR_TOKEN_MIN_LENGTH
    ) {
      throw new Error('OpenCode server supervisor did not establish an authenticated control channel')
    }

    ipc.send({
      type: 'start',
      token: ready.token,
      deadlineMonotonicNs: (
        process.hrtime.bigint() + BigInt(30_000) * 1_000_000n
      ).toString(),
    })
    await waitForServerState(() => state.targetStart, SUPERVISOR_START_TIMEOUT_MS, 'server start', state)
    const baseUrl = await waitForServerState(
      () => {
        if (output.overflow) throw new Error('OpenCode server output exceeded the test limit')
        return /^server listening on (http:\/\/\S+)$/m.exec(output.text)?.[1]?.trim()
      },
      SERVER_LISTEN_TIMEOUT_MS,
      'server listening address',
      state,
    )
    return { baseUrl, password }
  } catch (error) {
    try {
      await cleanup()
    } catch (cleanupError) {
      error.message = `${error.message}; cleanup also failed: ${cleanupError.message}`
    }
    throw error
  }
}

const tokens = value => ({
  input: value,
  output: value + 1,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})
const zeroTokens = () => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })
const model = id => ({ providerID: 'oats-sidebar-probe', id })

function sessionInfo(id, project, title, parentID) {
  return {
    id,
    ...(parentID ? { parentID } : {}),
    projectID: 'oats-sidebar-probe',
    agent: 'build',
    model: model('probe-model'),
    cost: 0,
    tokens: zeroTokens(),
    time: { created: 1000, updated: 2000 },
    title,
    location: { directory: project },
  }
}

function assistant(id, { agent, cost }) {
  return {
    id,
    time: { created: 1500, completed: 1600 },
    type: 'assistant',
    agent,
    model: model(`${agent}-model`),
    content: [],
    cost,
    tokens: tokens(1),
  }
}

/**
 * Import a root session with repeated alpha work and a nested beta child.
 * The session-level agent/model intentionally differ from the recorded message
 * identities so a regression that reads current configuration is visible.
 */
export async function importSidebarSessions({ baseUrl, password, project, title }) {
  const { OpenCode } = await import('@opencode/client/promise')
  const client = OpenCode.make({
    baseUrl,
    headers: {
      authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
    },
  })

  const suffix = randomBytes(6).toString('hex')
  const sessionID = `ses_sidebar_root_${suffix}`
  const childID = `ses_sidebar_child_${suffix}`
  const messageID = name => `msg_sidebar_${name}_${suffix}`

  await client.session.import({
    info: sessionInfo(sessionID, project, title),
    messages: [
      assistant(messageID('alpha-one'), { agent: 'alpha', cost: 1 }),
      assistant(messageID('alpha-two'), { agent: 'alpha', cost: 2 }),
    ],
  })
  await client.session.import({
    info: sessionInfo(childID, project, `${title} child`, sessionID),
    messages: [assistant(messageID('beta'), { agent: 'beta', cost: 2 })],
  })

  return {
    sessionID,
    childID,
    title,
    agents: [
      { name: 'alpha', cost: 3 },
      { name: 'beta', cost: 2 },
    ],
  }
}

/**
 * Start one authenticated server and import the synthetic sidebar sessions.
 * The returned close() must be awaited; cleanup failure is surfaced, never
 * swallowed.
 */
export async function startSidebarServer({ executable, title, prefix }) {
  const isolated = createIsolatedRoot(prefix)
  const lifecycle = {
    root: isolated.root,
    supervisor: null,
    cleanup: null,
    confirmed: false,
  }
  try {
    const { baseUrl, password } = await startSupervisedServer(
      executable,
      isolated.env,
      isolated.dirs.project,
      lifecycle,
    )
    const sessions = await importSidebarSessions({
      baseUrl,
      password,
      project: isolated.dirs.project,
      title,
    })
    let closed = false
    let retained = false
    return {
      ...isolated,
      baseUrl,
      password,
      sessions,
      /** Keep the shared root for diagnosis when a child harness cannot
       * confirm cleanup and no handle was returned to the caller. */
      retainRoot() {
        retained = true
      },
      async close({ retain = false } = {}) {
        if (closed) return
        closed = true
        let cleanupError
        try {
          await lifecycle.cleanup?.()
        } catch (error) {
          cleanupError = error
        }
        if (shouldRemoveRoot({
          retain,
          retained,
          confirmed: lifecycle.confirmed,
          hasSupervisor: Boolean(lifecycle.supervisor),
        })) {
          rmSync(isolated.root, { recursive: true, force: true })
        }
        if (cleanupError) throw cleanupError
      },
    }
  } catch (error) {
    try {
      await lifecycle.cleanup?.()
    } catch (cleanupError) {
      error.message = `${error.message}; cleanup also failed: ${cleanupError.message}`
    }
    if (shouldRemoveRoot({
      confirmed: lifecycle.confirmed,
      hasSupervisor: Boolean(lifecycle.supervisor),
    })) {
      rmSync(isolated.root, { recursive: true, force: true })
    }
    throw error
  }
}
