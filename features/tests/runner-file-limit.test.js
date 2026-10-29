// Issue #12: the runner contract bounds each file its subprocess writes, not
// only the bytes the parent reads afterwards. These tests exercise the real
// helper (`runProcess`) against real child processes; they never inspect or
// mock the limit mechanism itself. The observable contract is a per-file
// ceiling of at least 8 MiB and at most 8 MiB + 512 bytes, inherited by
// descendants, with a fail-closed refusal when the ceiling cannot be
// established.
//
// The ceiling is part of every `runProcess` launch (see README
// "Runner-contract disk limits"), so no option is passed here. Ordinary
// runner-contract semantics outside the ceiling (exit status, captured output,
// timeout reporting, bounded reads) must keep working.
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProcess, UNIT_PROBE } from './migration-process.js'

const FILE_LIMIT = 8 * 1024 * 1024
const CEILING_SLACK = 512
const MAX_FILE_LIMIT = FILE_LIMIT + CEILING_SLACK
const CHUNK_BYTES = 64 * 1024
const RUN_TIMEOUT_MS = 30000
const PROCESS_MODULE_URL = new URL('./migration-process.js', import.meta.url).href

function temporaryDirectory(t) {
  const base = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const dir = mkdtempSync(join(base, 'oats-file-limit-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function runContract(command, args, { cwd } = {}) {
  return runProcess(command, args, { cwd, env: process.env, timeout: RUN_TIMEOUT_MS, grace: 2000 })
}

// Writes each [path, targetBytes] in 64 KiB chunks and reports what the
// filesystem actually accepted, so a sparse truncate or a post-run trim cannot
// masquerade as a write-time ceiling.
function writePlanScript(plan) {
  // Handle SIGXFSZ explicitly: with the default disposition the kernel would
  // terminate the writer instead of surfacing EFBIG, and Node's default
  // disposition is not a portable contract.
  return `const fs = require('node:fs')
if (require('node:os').constants.signals.SIGXFSZ) process.on('SIGXFSZ', () => {})
const plan = ${JSON.stringify(plan)}
const results = []
for (const [path, target] of plan) {
  const chunk = Buffer.alloc(${CHUNK_BYTES}, 0x61)
  const fd = fs.openSync(path, 'w')
  let written = 0
  let error = null
  try {
    while (written < target) {
      written += fs.writeSync(fd, chunk, 0, Math.min(chunk.length, target - written))
    }
  } catch (caught) {
    error = caught.code || caught.message
  } finally {
    fs.closeSync(fd)
  }
  results.push({ path, target, written, error, size: fs.statSync(path).size })
}
console.log(JSON.stringify(results))
if (results.some(entry => entry.error)) process.exitCode = 1
`
}

function lastJsonLine(result) {
  const line = result.stdout.trim().split('\n').filter(Boolean).at(-1)
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

test('permitted file sizes succeed while the per-file cap is active', async t => {
  const dir = temporaryDirectory(t)
  const plan = [
    [join(dir, 'empty'), 0],
    [join(dir, 'one-mib'), 1024 * 1024],
    [join(dir, 'exactly-8-mib'), FILE_LIMIT],
  ]
  const result = await runContract(process.execPath, ['-e', writePlanScript(plan)], { cwd: dir })

  assert.equal(result.timedOut, false)
  assert.equal(result.signal, null)
  assert.equal(result.status, 0, result.stderr)
  const observed = lastJsonLine(result)
  assert.ok(observed, `the writer did not report its writes: ${result.stdout}${result.stderr}`)
  assert.deepEqual(observed.map(entry => entry.error), plan.map(() => null))
  assert.deepEqual(observed.map(entry => entry.written), plan.map(([, bytes]) => bytes))
  for (const [index, [path, bytes]] of plan.entries()) {
    assert.equal(observed[index].size, bytes)
    assert.equal(statSync(path).size, bytes, `the file is not ${bytes} bytes on disk`)
  }
})

test('an oversized write is stopped at the cap while it is being written', async t => {
  const dir = temporaryDirectory(t)
  const path = join(dir, 'oversized')
  const target = FILE_LIMIT + 4 * 1024 * 1024
  const result = await runContract(process.execPath, ['-e', writePlanScript([[path, target]])], { cwd: dir })

  const [observed] = lastJsonLine(result) ?? []
  assert.ok(observed, `the writer did not report its writes: ${result.stdout}${result.stderr}`)
  assert.equal(observed.error, 'EFBIG', 'the operating system must reject the write, not a later reader')
  assert.ok(observed.written < target, 'the oversized write completed despite the cap')
  assert.notEqual(result.status, 0, 'the writer must not report a truncated write as success')
  const size = statSync(path).size
  assert.ok(size >= FILE_LIMIT, `the write stopped below the permitted ceiling: ${size} bytes`)
  assert.ok(size <= MAX_FILE_LIMIT, `the file grew beyond the permitted ceiling: ${size} bytes`)
})

test('the per-file cap is inherited by descendant processes', async t => {
  const dir = temporaryDirectory(t)
  const path = join(dir, 'descendant-oversized')
  const target = FILE_LIMIT + 4 * 1024 * 1024
  const writer = writePlanScript([[path, target]])
  const parent = `const { spawnSync } = require('node:child_process')
const child = spawnSync(process.execPath, ['-e', ${JSON.stringify(writer)}], { encoding: 'utf8' })
console.log(JSON.stringify({ status: child.status, signal: child.signal, stdout: child.stdout.trim(), stderr: child.stderr.trim() }))
`
  const result = await runContract(process.execPath, ['-e', parent], { cwd: dir })

  assert.equal(result.status, 0, result.stderr)
  const observed = lastJsonLine(result)
  assert.ok(observed, `the parent did not report the descendant result: ${result.stdout}${result.stderr}`)
  assert.notEqual(observed.status, 0, 'the descendant completed its oversized write')
  const descendantWrites = JSON.parse(observed.stdout)
  assert.equal(descendantWrites[0].error, 'EFBIG')
  assert.ok(descendantWrites[0].written < target)
  const size = statSync(path).size
  assert.ok(size >= FILE_LIMIT, `the descendant stopped below the permitted ceiling: ${size} bytes`)
  assert.ok(size <= MAX_FILE_LIMIT, `the descendant grew the file beyond the ceiling: ${size} bytes`)
})

test('ordinary target exit status and output are unchanged by the cap', async t => {
  const dir = temporaryDirectory(t)
  const path = join(dir, 'permitted')
  const plan = [[path, 2 * 1024 * 1024]]
  const script = `${writePlanScript(plan)}
console.log('MARKER:DONE')
process.exitCode = 7
`
  const result = await runContract(process.execPath, ['-e', script], { cwd: dir })

  assert.equal(result.timedOut, false)
  assert.equal(result.signal, null)
  assert.equal(result.status, 7, result.stderr)
  assert.match(result.stdout, /MARKER:DONE/)
  const [observed] = JSON.parse(result.stdout.trim().split('\n')[0])
  assert.equal(observed.error, null)
  assert.equal(observed.written, 2 * 1024 * 1024)
  assert.equal(statSync(path).size, 2 * 1024 * 1024)
})

test('the runner contract refuses to execute when the inherited hard limit is too low', t => {
  const dir = temporaryDirectory(t)
  const probe = `import { runProcess } from ${JSON.stringify(PROCESS_MODULE_URL)}
try {
  const result = await runProcess(process.execPath, ['-e', 'console.log("CANARY")'], {
    cwd: ${JSON.stringify(dir)},
    env: process.env,
    timeout: ${RUN_TIMEOUT_MS},
  })
  console.log('OUTCOME:resolved', result.status, result.signal, JSON.stringify(result.stdout), JSON.stringify(result.stderr))
} catch (error) {
  console.log('OUTCOME:rejected', String(error.message))
}
`
  const runUnder = ulimitCommand => spawnSync('/bin/sh',
    ['-c', `${ulimitCommand}exec "$@"`, 'sh', process.execPath, '--input-type=module', '-e', probe],
    { encoding: 'utf8', timeout: 120000 })

  // Negative control: the same probe runs the target when the ceiling is
  // available, so the refusal below cannot be attributed to the probe itself.
  const control = runUnder('')
  assert.equal(control.status, 0, control.stderr)
  assert.match(control.stdout, /OUTCOME:resolved 0 null/)
  assert.match(control.stdout, /CANARY/, 'the control must execute the target')

  // A zero-byte hard limit cannot be raised, so the ceiling is unattainable.
  // The contract may reject the launch or return the wrapper's failure status,
  // but it must never run the target or report success.
  const restricted = runUnder('ulimit -f 0 || exit 99; ')
  assert.equal(restricted.status, 0, `the restricted probe failed: ${restricted.stderr}`)
  assert.doesNotMatch(restricted.stdout, /CANARY/, 'the target executed despite an unavailable required ceiling')
  assert.match(restricted.stdout + restricted.stderr, /limit/i, 'the refusal must explain itself')
  if (/OUTCOME:rejected/.test(restricted.stdout)) return
  const [, status, signal] = /OUTCOME:resolved (\S+) (\S+)/.exec(restricted.stdout) ?? []
  assert.ok(status !== undefined, `the contract did not report an outcome: ${restricted.stdout}${restricted.stderr}`)
  assert.ok(status !== '0' || signal !== 'null', 'the contract must not report success when it refused to launch')
})

// Runs the exported probe directly in a plain shell, without the supervisor or
// the wrapper, so only the probe's own SIGXFSZ handling is under test.
function runProbe(t, { shellLimit = 2, nodeArgs = [] } = {}) {
  const dir = temporaryDirectory(t)
  const path = join(dir, 'probe-target')
  const result = spawnSync('/bin/sh',
    ['-c', `ulimit -f ${shellLimit}; exec "$@"`, 'sh', process.execPath, ...nodeArgs, '-e', UNIT_PROBE, path],
    { encoding: 'utf8', timeout: RUN_TIMEOUT_MS })
  if (result.error) throw result.error
  return { result, path }
}

test('the limit probe handles SIGXFSZ itself and still observes EFBIG', t => {
  const dir = temporaryDirectory(t)
  const preload = join(dir, 'count-sigxfsz.cjs')
  // Report the probe's own listeners at exit; the preload registers none.
  writeFileSync(preload, `process.on('exit', () => process.stderr.write('SIGXFSZ_LISTENERS:' + process.listenerCount('SIGXFSZ') + '\\n'))\n`)
  const { result, path } = runProbe(t, { nodeArgs: ['-r', preload] })

  assert.equal(result.signal, null, 'the probe was killed by SIGXFSZ instead of handling it')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /SIGXFSZ_LISTENERS:1\b/, 'the probe must install its own handler, not rely on the default disposition')
  assert.match(result.stdout, /^\d+$/, 'the probe must report only its measured ceiling')
  // The shell's block size is 512 or 1024 bytes, so two blocks are at most 2 KiB.
  const ceiling = Number(result.stdout)
  assert.ok(ceiling > 0 && ceiling <= 2 * 1024, `the probe reported an implausible ceiling: ${ceiling}`)
  assert.equal(existsSync(path), false, 'the probe must remove its target file')
})

test('the limit probe fails closed when SIGXFSZ cannot be handled', t => {
  const dir = temporaryDirectory(t)
  const preload = join(dir, 'reject-sigxfsz.cjs')
  writeFileSync(preload, `const register = process.on
process.on = function (event, listener) {
  if (event === 'SIGXFSZ') throw new Error('simulated unsupported signal')
  return register.call(this, event, listener)
}
`)
  const { result, path } = runProbe(t, { nodeArgs: ['-r', preload] })

  assert.equal(result.signal, null)
  assert.notEqual(result.status, 0, 'the probe reported a ceiling without a usable SIGXFSZ handler')
  assert.equal(result.stdout, '', 'the wrapper must not receive a ceiling from an unverified probe')
  assert.equal(existsSync(path), false, 'the probe must not write before establishing its signal handling')
})
