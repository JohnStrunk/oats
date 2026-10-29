import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SUPERVISOR_PATH } from '../steps/tui_smoke_helper.js'
import { connectUntil } from './migration-ipc.js'

const MAX_OUTPUT = 4 * 1024 * 1024
const MAX_GRACE_MS = 5000
const MAX_TIMEOUT_MS = 300000
const EXIT_WAIT_MS = 15000
const CLOSE_WAIT_MS = 10000
const FINAL_WAIT_MS = 20000
const IPC_DRAIN_MS = 200
// Worst sequential bounded waits after the run deadline. The step deadline
// must allow even the failure path and its final cleanup attempt to finish.
export const PROCESS_MAX_CLEANUP_MS = MAX_GRACE_MS + EXIT_WAIT_MS + CLOSE_WAIT_MS + FINAL_WAIT_MS + IPC_DRAIN_MS

function boundedMilliseconds(value, name, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${name} must be a finite number of milliseconds >= ${minimum}`)
  }
  return Math.min(Math.ceil(value), maximum)
}

function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function within(promise, ms, message) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })])
  } finally {
    clearTimeout(timer)
  }
}

// Reuse the PTY harness's persistent group leader, without allocating a PTY.
// Only that live leader signals its own group: this process never signals a
// PID/PGID after it might have been reaped and reused.
export async function runProcess(command, args, { cwd, env, timeout = 120000, grace = 1000, maxOutput = MAX_OUTPUT, supervisorPath = SUPERVISOR_PATH, testStartDeadlineNs } = {}) {
  if (process.platform === 'win32') throw new Error('Migration subprocess isolation requires POSIX process groups')
  timeout = boundedMilliseconds(timeout, 'timeout', 1, MAX_TIMEOUT_MS)
  grace = boundedMilliseconds(grace, 'grace', 0, MAX_GRACE_MS)
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-process-'))
  const socketPath = join(dir, 'supervisor.sock')
  const target = deferred()
  const ready = deferred()
  const cleanup = deferred()
  const protocolError = deferred()
  const overflow = deferred()
  const exited = deferred()
  const closed = deferred()
  const output = { stdout: [], stderr: [] }
  const deadlineNs = process.hrtime.bigint() + BigInt(timeout) * 1000000n
  let bytes = 0
  let overLimit = false
  let ipc
  let cleanupMessage
  let protocolMessage
  let deadline
  const connectAbort = new AbortController()
  const supervisor = spawn(process.execPath, [supervisorPath, socketPath, command, ...args], {
    cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  function capture(stream, chunk) {
    if (overLimit) return
    if (bytes + chunk.length > maxOutput) {
      overLimit = true
      overflow.resolve({ kind: 'overflow' })
      return
    }
    bytes += chunk.length
    output[stream].push(chunk)
  }
  supervisor.stdout.on('data', chunk => capture('stdout', chunk))
  supervisor.stderr.on('data', chunk => capture('stderr', chunk))
  supervisor.on('error', error => { connectAbort.abort(error); exited.resolve({ kind: 'supervisor-error', error }) })
  supervisor.on('exit', (status, signal) => {
    connectAbort.abort(new Error('Process supervisor exited before control was established'))
    exited.resolve({ kind: 'supervisor-exit', status, signal })
  })
  supervisor.on('close', (status, signal) => closed.resolve({ status, signal }))
  const timed = new Promise(resolve => { deadline = setTimeout(() => {
    connectAbort.abort(new Error('Process timed out before supervisor control was established'))
    resolve({ kind: 'timeout' })
  }, timeout) })

  try {
    ipc = await connectUntil(socketPath, connectAbort.signal)
    ipc.onMessage(message => {
      if (message.type === 'ready') ready.resolve({ kind: 'ready', ...message })
      if (message.type === 'target-exit') target.resolve({ kind: 'target-exit', ...message })
      if (message.type === 'clean' || message.type === 'killing') {
        cleanupMessage = message.type
        cleanup.resolve(message.type)
      }
      if (message.type === 'error' && protocolMessage === undefined) {
        protocolMessage = typeof message.message === 'string' ? message.message : 'unspecified supervisor error'
        protocolError.resolve({ kind: 'protocol-error', message: protocolMessage })
      }
    })
    const handshake = await Promise.race([
      ready.promise, timed, overflow.promise, exited.promise, protocolError.promise,
      ipc.closed.then(() => ({ kind: 'ipc-closed' })),
    ])
    if (handshake.kind !== 'ready' || handshake.protocol !== 2 || handshake.pid !== supervisor.pid ||
        typeof handshake.token !== 'string' || handshake.token.length < 32) {
      throw new Error('Process supervisor did not establish an authenticated control channel')
    }
    let first
    if (connectAbort.signal.aborted || process.hrtime.bigint() >= deadlineNs) {
      first = { kind: 'timeout' }
    } else {
      // Optional override is a test seam for exercising supervisor rejection.
      ipc.send({ type: 'start', token: handshake.token, deadlineMonotonicNs: testStartDeadlineNs ?? deadlineNs.toString() })
      first = await Promise.race([
        target.promise, timed, overflow.promise, exited.promise, protocolError.promise,
        ipc.closed.then(() => ({ kind: 'ipc-closed' })),
      ])
    }
    clearTimeout(deadline)
    if (first.kind !== 'supervisor-exit' && first.kind !== 'supervisor-error' && first.kind !== 'ipc-closed') {
      ipc.send({ type: 'shutdown', token: handshake.token, graceMs: grace })
    }
    // The supervisor either reports cleanup or dies; it remains the PGID
    // anchor until its own final group signal. Never perform a fallback kill.
    const finish = await within(exited.promise, grace + EXIT_WAIT_MS, 'Process supervisor did not exit after cleanup')
    await within(closed.promise, CLOSE_WAIT_MS, 'Process supervisor output did not close')
    if (!cleanupMessage) await Promise.race([cleanup.promise, delay(IPC_DRAIN_MS)])
    // "killing" is only an intention to signal the group, not evidence that
    // the signal was delivered. A SIGKILL exit can also be caused externally.
    // Accept only an explicit clean report followed by a successful exit.
    if (cleanupMessage !== 'clean' || finish.status !== 0 || finish.signal !== null) {
      throw new Error('Process supervisor did not confirm descendant cleanup')
    }
    if (overLimit) throw new Error(`Process output exceeded ${maxOutput} bytes`)
    if (protocolMessage !== undefined) {
      if (protocolMessage === 'start deadline has already expired') first = { kind: 'timeout' }
      else throw new Error(`Process supervisor rejected request: ${protocolMessage}`)
    }
    if (first.kind === 'supervisor-error') throw first.error
    if (first.kind === 'supervisor-exit' || first.kind === 'ipc-closed') {
      throw new Error('Process supervisor exited before reporting target completion')
    }
    if (first.kind === 'target-exit' && first.error) throw new Error(`Process failed to start: ${first.error}`)
    return {
      status: first.kind === 'target-exit' ? first.exitCode : null,
      signal: first.kind === 'target-exit' ? first.signal : null,
      timedOut: first.kind === 'timeout',
      stdout: Buffer.concat(output.stdout).toString('utf8'),
      stderr: Buffer.concat(output.stderr).toString('utf8'),
    }
  } finally {
    clearTimeout(deadline)
    // Disconnection itself tells a live supervisor to clean its group. If
    // IPC setup/cleanup failed, wait for its watchdog instead of signalling.
    ipc?.close()
    await within(closed.promise, FINAL_WAIT_MS, 'Process supervisor did not close').catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  }
}
