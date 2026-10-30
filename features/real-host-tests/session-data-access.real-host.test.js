import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  SUPERVISOR_PATH,
  connectSupervisor,
} from '../steps/tui_smoke_helper.js'
import { requireRealHost } from './prerequisites.js'

// Run with an explicitly selected pinned host:
//   OATS_OPENCODE=/absolute/path/to/opencode npm run test:real-host
//
// This test exercises the real OpenCode v2.0.32 HTTP/SDK surface and the
// checked-in session data access implementation. It deliberately imports a
// synthetic transcript instead of prompting a model: v2.0.32 has no supported
// way to induce a settled step without a model call. Live settlement and event
// de-duplication remain covered by the unit fixtures.
//
// The test fails if the selected host or the isolation prerequisites are not
// available. The runner also rejects skips, including future accidental skips.

const SUPERVISOR_PROTOCOL = 2
const SUPERVISOR_TOKEN_MIN_LENGTH = 32
const SUPERVISOR_CONNECT_TIMEOUT_MS = 5_000
const SUPERVISOR_START_TIMEOUT_MS = 10_000
const SUPERVISOR_CLEANUP_TIMEOUT_MS = 15_000
const SUPERVISOR_GRACE_MS = 5_000
const SERVER_LISTEN_TIMEOUT_MS = 20_000
const MAX_SERVER_OUTPUT = 1024 * 1024
const MAX_TEST_MS = 120_000

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function isolatedEnvironment(root) {
  const dirs = {
    home: join(root, 'home'),
    config: join(root, 'config'),
    data: join(root, 'data'),
    cache: join(root, 'cache'),
    state: join(root, 'state'),
    runtime: join(root, 'runtime'),
    temp: join(root, 'tmp'),
    project: join(root, 'project'),
  }
  for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true, mode: 0o700 })
  return {
    dirs,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LC_ALL: 'C.UTF-8',
      HOME: dirs.home,
      TMPDIR: dirs.temp,
      XDG_CONFIG_HOME: dirs.config,
      XDG_DATA_HOME: dirs.data,
      XDG_CACHE_HOME: dirs.cache,
      XDG_STATE_HOME: dirs.state,
      XDG_RUNTIME_DIR: dirs.runtime,
      OPENCODE_DISABLE_PROJECT_CONFIG: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ plugins: [], highlights: false }),
    },
  }
}

function captureOutput(stream, state) {
  stream.setEncoding('utf8')
  stream.on('data', chunk => {
    if (state.overflow) return
    const bytes = Buffer.byteLength(chunk)
    if (state.bytes + bytes > MAX_SERVER_OUTPUT) {
      state.overflow = true
      return
    }
    state.bytes += bytes
    state.text += chunk
  })
}

function describeExit(value) {
  if (!value) return 'unknown'
  if (value.error) return `error ${value.error}`
  return `code ${value.status ?? 'null'} signal ${value.signal ?? 'null'}`
}

function assertSupervisorHealthy(state) {
  if (state.spawnError) {
    throw new Error(`OpenCode supervisor failed to start: ${state.spawnError.message}`)
  }
  if (state.protocolError) {
    throw new Error(`OpenCode supervisor rejected control: ${state.protocolError}`)
  }
  if (state.exit) {
    throw new Error(`OpenCode supervisor exited before cleanup (${describeExit(state.exit)})`)
  }
  if (state.closed) {
    throw new Error('OpenCode supervisor control channel closed before cleanup')
  }
  if (state.targetExit) {
    throw new Error(`OpenCode server exited before cleanup (${describeExit(state.targetExit)})`)
  }
}

async function waitForServerState(predicate, timeoutMs, label, state) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    assertSupervisorHealthy(state)
    const value = predicate()
    if (value) return value
    await delay(50)
  }
  assertSupervisorHealthy(state)
  throw new Error(`Timed out waiting for ${label}`)
}

function createSupervisorCleanup(state, ipcRef, lifecycle) {
  let cleanupPromise
  return () => {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      const ipc = ipcRef.current
      if (ipc && state.ready && state.cleanup == null) {
        try {
          ipc.send({
            type: 'shutdown',
            token: state.ready.token,
            graceMs: SUPERVISOR_GRACE_MS,
          })
        } catch {
          // Closing the control channel below still lets a live supervisor
          // clean its group, but the result cannot be reported as confirmed.
        }
      } else {
        try { ipc?.close() } catch {}
      }

      const deadline = Date.now() + SUPERVISOR_CLEANUP_TIMEOUT_MS
      while (Date.now() < deadline && !(state.exit && state.closed)) {
        await delay(50)
      }
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
        return true
      }

      const detail = state.cleanup === 'killing'
        ? 'supervisor escalated to SIGKILL'
        : state.cleanup == null
          ? `no cleanup report, ${describeExit(state.exit)}`
          : `cleanup report ${state.cleanup}, ${describeExit(state.exit)}`
      throw new Error(
        `OpenCode supervisor cleanup unconfirmed (${detail}); ` +
          `temporary data retained at ${lifecycle.root}`,
      )
    })()
    return cleanupPromise
  }
}

async function startSupervisedServer(executable, env, project, lifecycle) {
  const password = randomBytes(32).toString('base64url')
  const socketPath = join(lifecycle.root, 'supervisor.sock')
  const supervisor = spawn(
    process.execPath,
    [SUPERVISOR_PATH, socketPath, executable, 'serve', '--hostname', '127.0.0.1', '--port', '0'],
    {
      cwd: project,
      env: { ...env, OPENCODE_SERVER_PASSWORD: password },
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
  const cleanup = createSupervisorCleanup(state, ipcRef, lifecycle)
  lifecycle.cleanup = cleanup

  const output = { text: '', bytes: 0, overflow: false }
  captureOutput(supervisor.stdout, output)
  captureOutput(supervisor.stderr, output)
  supervisor.on('error', error => { state.spawnError = error })
  supervisor.on('exit', (status, signal) => { state.exit = { status, signal } })
  supervisor.on('close', () => { state.closed = true })

  try {
    const ipc = await connectSupervisor(socketPath, {
      timeoutMs: SUPERVISOR_CONNECT_TIMEOUT_MS,
    })
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
      'supervisor handshake',
      state,
    )
    if (
      ready.protocol !== SUPERVISOR_PROTOCOL ||
      ready.pid !== supervisor.pid ||
      typeof ready.token !== 'string' ||
      ready.token.length < SUPERVISOR_TOKEN_MIN_LENGTH
    ) {
      throw new Error('OpenCode supervisor did not establish an authenticated control channel')
    }

    ipc.send({
      type: 'start',
      token: ready.token,
      deadlineMonotonicNs: (
        process.hrtime.bigint() + BigInt(30_000) * 1_000_000n
      ).toString(),
    })
    await waitForServerState(
      () => state.targetStart,
      SUPERVISOR_START_TIMEOUT_MS,
      'server start',
      state,
    )
    const baseUrl = await waitForServerState(
      () => {
        if (output.overflow) throw new Error('OpenCode server output exceeded the test limit')
        return /^server listening on (http:\/\/\S+)$/m.exec(output.text)?.[1]?.trim()
      },
      SERVER_LISTEN_TIMEOUT_MS,
      'server listening address',
      state,
    )
    // OPENCODE_SERVER_PASSWORD suppresses the printed password. Fall back to a
    // printed value only for a host build that ignores that variable.
    const printed = /^server password (.+)$/m.exec(output.text)
    return { baseUrl, password: printed?.[1]?.trim() ?? password }
  } catch (error) {
    try {
      await cleanup()
    } catch (cleanupError) {
      error.message = `${error.message}; cleanup also failed: ${cleanupError.message}`
    }
    throw error
  }
}

const tokens = n => ({
  input: n,
  output: n + 1,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})
const zeroTokens = () => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})
const model = id => ({ providerID: 'probe-provider', id })

function sessionInfo(id, project, parentID) {
  return {
    id,
    ...(parentID ? { parentID } : {}),
    projectID: 'probe-project',
    agent: 'current-session-agent',
    model: model('current-session-model'),
    cost: 999,
    tokens: tokens(999),
    time: { created: 1000, updated: 2000 },
    title: `probe ${id}`,
    location: { directory: project },
  }
}

function assistant(id, { agent, modelID, cost = 1, usage = tokens(1), extra = {} } = {}) {
  return {
    id,
    time: { created: 1500, completed: 1600 },
    type: 'assistant',
    agent: agent ?? `${id}-agent`,
    model: model(modelID ?? `${id}-model`),
    content: [],
    cost,
    tokens: usage,
    ...extra,
  }
}

function recordKey(record) {
  return `${record.sessionID}/${record.messageID}`
}

function assertSnapshotScope(snapshot, sessionID, expectedKeys) {
  assert.equal(snapshot.sessionID, sessionID)
  const keys = snapshot.records.map(recordKey).sort()
  assert.deepEqual(keys, [...expectedKeys].sort())
  assert.equal(new Set(keys).size, keys.length, 'records must not be duplicated')
  assert.ok(snapshot.records.every(record => typeof record.id === 'string' && record.id.length > 0))
}

test('session data access follows the pinned OpenCode session tree', { timeout: MAX_TEST_MS }, async t => {
  const host = requireRealHost(process.env.OATS_OPENCODE)

  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const root = mkdtempSync(join(tempRoot, 'oats-session-real-host-'))
  const { dirs, env } = isolatedEnvironment(root)
  // Start the server under the repository's persistent process-group leader.
  // Cleanup is confirmed only by a `clean` report, exit code 0, no signal, and
  // closed stdio. Otherwise this test fails closed and retains the synthetic
  // tree for diagnosis instead of deleting it under a possibly-live process.
  const lifecycle = {
    root,
    supervisor: null,
    cleanup: null,
    confirmed: false,
  }
  t.after(async () => {
    let cleanupError
    try {
      if (lifecycle.cleanup) await lifecycle.cleanup()
    } catch (error) {
      cleanupError = error
    }
    // Only remove the synthetic tree after the supervisor confirmed group
    // cleanup. If cleanup is unconfirmed, retain it for diagnosis; deleting it
    // cannot make a live descendant safe.
    if (lifecycle.confirmed || !lifecycle.supervisor) {
      rmSync(root, { recursive: true, force: true })
    }
    if (cleanupError) throw cleanupError
  })

  const started = await startSupervisedServer(
    host.executable,
    env,
    dirs.project,
    lifecycle,
  )
  const auth = 'Basic ' + Buffer.from(`opencode:${started.password}`).toString('base64')
  // @opencode/client is the pinned promise client pulled in by
  // @opencode/plugin; it is not a separate direct dependency.
  const { OpenCode } = await import('@opencode/client/promise')
  const client = OpenCode.make({
    baseUrl: started.baseUrl,
    headers: { authorization: auth },
  })

  const suffix = randomBytes(6).toString('hex')
  const id = name => `ses_real_${name}_${suffix}`
  const messageID = name => `msg_real_${name}_${suffix}`
  const ids = {
    ancestor: id('ancestor'),
    root: id('root'),
    child: id('child'),
    child2: id('child2'),
    grandchild: id('grandchild'),
    gapchild: id('gapchild'),
    other: id('other'),
  }

  const rootMessages = [
    assistant(messageID('root-1'), {
      agent: 'root-one-agent',
      modelID: 'root-one-model',
      cost: 1,
      usage: tokens(1),
      extra: { content: [{ type: 'text', text: 'SECRET_ROOT_CONTENT' }] },
    }),
    assistant(messageID('root-2'), {
      agent: 'root-two-agent',
      modelID: 'root-two-model',
      cost: 2,
      usage: tokens(2),
    }),
  ]
  const gapMessages = [
    (() => {
      const message = assistant(messageID('gap-missing'), {
        agent: 'gap-agent',
        modelID: 'gap-model',
      })
      delete message.cost
      delete message.tokens
      return message
    })(),
    assistant(messageID('gap-zero'), {
      agent: 'zero-agent',
      modelID: 'zero-model',
      cost: 0,
      usage: zeroTokens(),
    }),
    {
      id: messageID('gap-user'),
      time: { created: 1500 },
      type: 'user',
      text: 'SECRET_USER_PROMPT',
    },
  ]
  // Imported assistant messages carry their own execution identity. The
  // session-level agent/model intentionally differ so a regression that uses
  // current configuration instead of recorded identity is visible.
  const specs = [
    ['ancestor', undefined, [assistant(messageID('ancestor'))]],
    ['root', ids.ancestor, rootMessages],
    ['child', ids.root, [assistant(messageID('child'), { agent: 'child-agent', modelID: 'child-model' })]],
    ['child2', ids.root, [assistant(messageID('child2'), { agent: 'child2-agent', modelID: 'child2-model' })]],
    ['grandchild', ids.child, [assistant(messageID('grandchild'), { agent: 'grand-agent', modelID: 'grand-model' })]],
    ['gapchild', ids.root, gapMessages],
    ['other', ids.ancestor, [assistant(messageID('other'))]],
  ]
  for (const [name, parentID, messages] of specs) {
    await client.session.import({
      info: sessionInfo(ids[name], dirs.project, parentID),
      messages,
    })
  }

  // Real client pagination shape: the first page may be ordered, but a cursor
  // page must not repeat order. Cursor.next can remain set after the last page.
  const firstMessagePage = await client.message.list({
    sessionID: ids.root,
    type: 'assistant',
    order: 'asc',
    limit: 1,
  })
  assert.equal(firstMessagePage.data.length, 1)
  assert.ok(firstMessagePage.cursor.next)
  await assert.rejects(
    client.message.list({
      sessionID: ids.root,
      type: 'assistant',
      order: 'asc',
      limit: 1,
      cursor: firstMessagePage.cursor.next,
    }),
    error => error?._tag === 'InvalidCursorError',
    'message cursors must not be combined with order',
  )
  const secondMessagePage = await client.message.list({
    sessionID: ids.root,
    type: 'assistant',
    limit: 1,
    cursor: firstMessagePage.cursor.next,
  })
  assert.equal(secondMessagePage.data.length, 1)
  assert.notEqual(secondMessagePage.data[0].id, firstMessagePage.data[0].id)

  const firstChildPage = await client.session.list({
    parentID: ids.root,
    order: 'asc',
    limit: 1,
  })
  assert.equal(firstChildPage.data.length, 1)
  assert.ok(firstChildPage.cursor.next)
  const secondChildPage = await client.session.list({
    parentID: ids.root,
    limit: 1,
    cursor: firstChildPage.cursor.next,
  })
  assert.equal(secondChildPage.data.length, 1)
  assert.notEqual(secondChildPage.data[0].id, firstChildPage.data[0].id)

  const logItems = []
  for await (const item of client.session.log({ sessionID: ids.root, follow: false })) {
    logItems.push(item)
  }
  assert.deepEqual(logItems.map(item => item.type), ['log.synced'])

  // Missing assistant identity is not representable through the supported
  // import boundary in v2.0.32. This is the documented reason the acceptance
  // fixture uses a fake for that shape; missing cost/tokens remains real.
  const invalid = assistant(messageID('invalid'))
  delete invalid.agent
  delete invalid.model
  await assert.rejects(
    client.session.import({
      info: sessionInfo(id('invalid'), dirs.project, ids.root),
      messages: [invalid],
    }),
    error => error?._tag === 'InvalidRequestError',
    'v2.0.32 requires assistant agent/model on import',
  )

  const { createSessionDataAccess } = await import('../../src/session-data-access.js')
  const serviceFor = sessionID => createSessionDataAccess({
    client,
    data: {
      on: () => () => {},
      listen: () => () => {},
    },
    ui: {
      router: {
        current: () => sessionID == null
          ? { type: 'home' }
          : { type: 'session', sessionID },
      },
    },
  })

  const rootService = serviceFor(ids.root)
  try {
    await rootService.refresh()
    await rootService.refresh()
    const snapshot = rootService.getSnapshot()
    const expected = [
      `${ids.root}/${messageID('root-1')}`,
      `${ids.root}/${messageID('root-2')}`,
      `${ids.child}/${messageID('child')}`,
      `${ids.child2}/${messageID('child2')}`,
      `${ids.grandchild}/${messageID('grandchild')}`,
      `${ids.gapchild}/${messageID('gap-missing')}`,
      `${ids.gapchild}/${messageID('gap-zero')}`,
    ]
    assertSnapshotScope(snapshot, ids.root, expected)
    assert.deepEqual(snapshot.errors, [], 'the real host must not produce message.list cursor errors')

    const byMessage = new Map(snapshot.records.map(record => [record.messageID, record]))
    const rootOne = byMessage.get(messageID('root-1'))
    const rootTwo = byMessage.get(messageID('root-2'))
    assert.equal(rootOne.agent, 'root-one-agent')
    assert.deepEqual(rootOne.model, model('root-one-model'))
    assert.equal(rootOne.cost, 1)
    assert.deepEqual(rootOne.tokens, tokens(1))
    assert.equal(rootTwo.agent, 'root-two-agent')
    assert.deepEqual(rootTwo.model, model('root-two-model'))

    const missing = byMessage.get(messageID('gap-missing'))
    const zero = byMessage.get(messageID('gap-zero'))
    assert.equal(missing.agent, 'gap-agent')
    assert.deepEqual(missing.model, model('gap-model'))
    assert.equal(missing.cost, null)
    assert.equal(missing.tokens, null)
    assert.equal(zero.cost, 0)
    assert.deepEqual(zero.tokens, zeroTokens())
    assert.notEqual(missing.cost, zero.cost)

    // v2.0.32 retains assistant messages but not durable usage events. The
    // implementation must expose that historical gap rather than claiming
    // completeness; missing cost/tokens is a separate record-level gap.
    assert.equal(snapshot.complete, false)
    const historicalGaps = snapshot.gaps
      .filter(gap => gap.kind === 'historical-usage-unavailable')
      .map(gap => gap.sessionID)
      .sort()
    assert.deepEqual(
      historicalGaps,
      [ids.root, ids.child, ids.child2, ids.grandchild, ids.gapchild].sort(),
    )
    assert.ok(snapshot.gaps.some(gap =>
      gap.kind === 'missing-usage' && gap.messageID === messageID('gap-missing')))
    assert.ok(!snapshot.gaps.some(gap =>
      gap.kind === 'missing-usage' && gap.messageID === messageID('gap-zero')))
    assert.ok(!JSON.stringify(snapshot).includes('SECRET_'), 'raw conversation content must not escape')
  } finally {
    rootService.dispose()
  }

  const childService = serviceFor(ids.child)
  try {
    await childService.refresh()
    const snapshot = childService.getSnapshot()
    assertSnapshotScope(snapshot, ids.child, [
      `${ids.child}/${messageID('child')}`,
      `${ids.grandchild}/${messageID('grandchild')}`,
    ])
    assert.deepEqual(snapshot.errors, [])
  } finally {
    childService.dispose()
  }

  const homeService = serviceFor(null)
  try {
    await homeService.refresh()
    const snapshot = homeService.getSnapshot()
    assert.equal(snapshot.sessionID, null)
    assert.deepEqual(snapshot.records, [])
    assert.deepEqual(snapshot.errors, [])
  } finally {
    homeService.dispose()
  }
})
