// The fixture exercises the existing npm/Cucumber contract, not a replacement
// runner. The parent independently stats the output before sandbox cleanup.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import fc from 'fast-check'
import { createMigrationFixture } from '../tests/migration-step-support.js'
import { cleanupSandbox, sandboxEnvironment } from '../tests/migration-sandbox.js'
import { runProcess } from '../tests/migration-process.js'
import { MIGRATION_RUN_TIMEOUT_MS, MIGRATION_STEP_TIMEOUT_MS } from '../tests/migration-time-budget.js'

// Two wrappers run serially, each with its own runner and cleanup budget.
const WRAPPER_TIMEOUT_MS = MIGRATION_STEP_TIMEOUT_MS + 10000
export const UNAVAILABLE_LIMIT_STEP_TIMEOUT_MS = 2 * WRAPPER_TIMEOUT_MS + 10000

export async function runDiskLimitFixture(file, writer) {
  const fixture = await createMigrationFixture()
  const observation = join(fixture.dir, 'write-observation.json')
  const report = join(fixture.dir, 'report.json')
  const probe = join(fixture.dir, 'probe.log')
  const path = file === 'report' ? report : file === 'probe' ? probe : join(fixture.dir, 'other-output')
  const limit = 8 * 1024 * 1024
  const sizes = [0, 1, ...fc.sample(fc.integer({ min: 0, max: limit }), { seed: 12012, numRuns: 8 }), limit - 1, limit]
  // A synchronous write loop measures actual writes, not a sparse truncate or
  // a post-run read limit. The final attempted chunk goes past the ceiling.
  const writeCode = `const fs = require('node:fs')
const file = process.argv[1], observation = process.argv[2]
// Node exposes signal handlers on platforms that support the signal. Install
// one before writing rather than depending on Node's default disposition.
if (require('node:os').constants.signals.SIGXFSZ) process.on('SIGXFSZ', () => {})
fs.writeFileSync(observation, JSON.stringify({ attempted: true }))
let bytes = 0, code = null, completed = false
const fd = fs.openSync(file, 'w')
try {
  const block = Buffer.alloc(65536, 0x61)
  for (let i = 0; i < 160; i++) bytes += fs.writeSync(fd, block)
  completed = true
} catch (e) { code = e.code } finally { fs.closeSync(fd) }
fs.writeFileSync(observation, JSON.stringify({ attempted: true, completed, code, bytes: fs.statSync(file).size }))
if (!completed) process.exitCode = 1
`
  const source = `import { Given } from '@cucumber/cucumber'
import { appendFileSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
Given('the {string} sandbox probe records execution', function (component) {
  const dir = ${JSON.stringify(fixture.dir)}, observation = ${JSON.stringify(observation)}
  const kind = ${JSON.stringify(file)}, writer = ${JSON.stringify(writer)}
  if (kind === 'small') {
    const expected = ${JSON.stringify(sizes)}, actual = []
    for (let i = 0; i < expected.length; i++) {
      const path = join(dir, 'allowed-' + i)
      writeFileSync(path, Buffer.alloc(expected[i], 0x61))
      actual.push(statSync(path).size)
    }
    writeFileSync(observation, JSON.stringify({ completed: true, expected, actual }))
    appendFileSync(process.env.OATS_SANDBOX_PROBE_LOG, component + '\\n')
    return
  }
  const format = process.argv.find(arg => arg.startsWith('json:'))
  const path = kind === 'probe' ? process.env.OATS_SANDBOX_PROBE_LOG : kind === 'report' ? format.slice(5) : join(dir, 'other-output')
  const code = ${JSON.stringify(writeCode)}
  if (writer === 'descendant') {
    const child = spawnSync(process.execPath, ['-e', code, path, observation], { encoding: 'utf8' })
    if (child.error) throw child.error
    if (child.signal === 'SIGXFSZ') {
      writeFileSync(observation, JSON.stringify({ attempted: true, completed: false, signal: child.signal }))
    }
    if (child.status !== 0) throw new Error('descendant write failed: ' + child.stderr)
  } else {
    // Run the same writer in this Cucumber process, preserving direct writes.
    if (require('node:os').constants.signals.SIGXFSZ) process.on('SIGXFSZ', () => {})
    const fs = require('node:fs'), fd = fs.openSync(path, 'w')
    fs.writeFileSync(observation, JSON.stringify({ attempted: true }))
    let completed = false, code = null
    try {
      const block = Buffer.alloc(65536, 0x61)
      for (let i = 0; i < 160; i++) fs.writeSync(fd, block)
      completed = true
    } catch (e) { code = e.code } finally { fs.closeSync(fd) }
    fs.writeFileSync(observation, JSON.stringify({ attempted: true, completed, code, bytes: fs.statSync(path).size }))
    if (!completed) throw new Error('sandbox write failed: ' + code)
  }
})
`
  try {
    writeFileSync(join(fixture.dir, 'features/steps/given/sandbox-probe.js'), source)
    let result, error
    try {
      result = await runProcess('npm', ['run', 'test:features', '--', '--tags', '@component:plugin-ui', '--format', `json:${report}`], {
        cwd: fixture.dir, env: sandboxEnvironment(fixture.dir, { probeLog: probe }), timeout: MIGRATION_RUN_TIMEOUT_MS,
      })
    } catch (caught) { error = caught }
    return { result, error, expectedSizes: sizes, observation: existsSync(observation) ? JSON.parse(readFileSync(observation, 'utf8')) : undefined,
      diskSize: file !== 'small' && existsSync(path) ? statSync(path).size : undefined,
      permittedDiskSizes: file === 'small' ? sizes.map((_, i) => statSync(join(fixture.dir, 'allowed-' + i)).size) : undefined }
  } finally {
    cleanupSandbox(fixture.dir)
  }
}

export async function runUnavailableLimitFixture() {
  const fixture = await createMigrationFixture()
  try {
    const npm = spawnSync('which', ['npm'], { encoding: 'utf8' })
    if (npm.status !== 0) throw new Error('Cannot locate npm for the runner contract fixture')
    const tools = join(fixture.dir, 'tools')
    mkdirSync(tools)
    writeFileSync(join(tools, 'npm'), `#!/bin/sh\necho OATS_NPM_LAUNCHED >&2\nexec ${JSON.stringify(npm.stdout.trim())} "$@"\n`, { mode: 0o755 })
    writeFileSync(join(fixture.dir, 'features/steps/given/sandbox-probe.js'), `import { Given } from '@cucumber/cucumber'
Given('the {string} sandbox probe records execution', component => console.log('OATS_FILE_LIMIT_CANARY', component))
`)
    const processModule = pathToFileURL(join(process.cwd(), 'features/tests/migration-process.js')).href
    const sandboxModule = pathToFileURL(join(process.cwd(), 'features/tests/migration-sandbox.js')).href
    const script = `import { runProcess } from ${JSON.stringify(processModule)}
import { sandboxEnvironment } from ${JSON.stringify(sandboxModule)}
try {
  const dir = ${JSON.stringify(fixture.dir)}
  const result = await runProcess('npm', ['run', 'test:features', '--', '--tags', '@component:plugin-ui', '--format', 'json:' + dir + '/report.json'],
    { cwd: dir, env: sandboxEnvironment(dir, { probeLog: dir + '/probe.log' }), timeout: ${MIGRATION_RUN_TIMEOUT_MS} })
  console.log(result.status === 0 ? 'RESULT:' : 'FAILED:', result.status, result.stdout, result.stderr)
} catch (error) { console.log('FAILED:', error.message) }
`
    const run = limited => {
      const args = limited
        ? ['-c', 'ulimit -f 0 || exit 99; exec "$@"', 'sh', process.execPath, '--input-type=module', '-e', script]
        : ['-c', 'exec "$@"', 'sh', process.execPath, '--input-type=module', '-e', script]
      const result = spawnSync('/bin/sh', args, { cwd: process.cwd(), env: { ...process.env, PATH: `${tools}:${process.env.PATH}` }, encoding: 'utf8', timeout: WRAPPER_TIMEOUT_MS })
      if (result.error) throw result.error
      if (result.status !== 0) throw new Error(`Limit test wrapper failed (${result.status}): ${result.stderr}`)
      return result.stdout + result.stderr
    }
    return { control: run(false), restricted: run(true) }
  } finally {
    cleanupSandbox(fixture.dir)
  }
}
