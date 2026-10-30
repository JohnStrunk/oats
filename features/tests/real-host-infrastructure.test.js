import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { requireRealHost } from '../real-host-tests/prerequisites.js'
import { REQUIRED_REAL_HOST_SUITES, SIDEBAR_SUITE } from '../real-host-tests/required-suites.js'
import { configuredHostVersion } from '../steps/host_pin_helper.js'

const PIN = configuredHostVersion()

function temp(t) {
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-host-contract-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('required host runner rejects skipped, todo, failing, empty and unrelated tests', async t => {
  const dir = temp(t)
  const file = join(dir, 'fixture.cjs')
  const entry = join(dir, 'runner.mjs')
  const runner = new URL('../real-host-tests/required-test-runner.js', import.meta.url).href
  writeFileSync(entry, `import { runRequiredTestFile } from ${JSON.stringify(runner)}; if (!await runRequiredTestFile(process.argv[2], 'contract')) process.exitCode = 1\n`)
  const cases = [
    ["test('contract', () => {})", true],
    ["test('contract', t => t.skip('unsafe system configuration'))", false],
    ["test.todo('contract')", false],
    ["test('contract', () => { throw Error('failure') })", false],
    ['', false],
    ["test('unrelated', () => {})", false],
    ["test('contract', () => {}); test.skip('second')", false],
  ]
  for (const [source, expected] of cases) {
    writeFileSync(file, `const test = require('node:test');\n${source}\n`)
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const result = spawnSync(process.execPath, [entry, file], { env, encoding: 'utf8', timeout: 30000 })
    assert.ifError(result.error)
    assert.equal(result.status === 0, expected, `${source}: ${result.stdout}\n${result.stderr}`)
  }
})

test('system configuration and uninspectable sources fail instead of skipping', t => {
  const dir = temp(t)
  const host = join(dir, 'opencode')
  writeFileSync(host, `#!/bin/sh\necho 'opencode v${PIN}'\n`, { mode: 0o700 })
  const absent = join(dir, 'absent')
  assert.deepEqual(requireRealHost(host, { sources: [absent], platform: 'linux' }), { executable: host })
  const config = join(dir, 'system-config')
  mkdirSync(config)
  assert.throws(() => requireRealHost(host, { sources: [config], platform: 'linux' }), /Cannot isolate OpenCode/)
  const file = join(dir, 'not-a-directory')
  writeFileSync(file, '')
  assert.throws(() => requireRealHost(host, { sources: [join(file, 'child')], platform: 'linux' }), /Cannot inspect OpenCode/)
  assert.throws(() => requireRealHost(host, { sources: [], platform: 'win32' }), /POSIX/)
})

test('the real-host gate includes the sidebar contract with coordinated names', () => {
  assert.deepEqual(
    REQUIRED_REAL_HOST_SUITES.map(suite => suite.file),
    ['session-data-access.real-host.test.js', 'plugin-sidebar.real-host.test.js'],
  )
  assert.equal(
    SIDEBAR_SUITE.name,
    'the real pinned OpenCode TUI renders and toggles the actual OATS Agent stats sidebar',
  )
  assert.equal(new Set(REQUIRED_REAL_HOST_SUITES.map(suite => suite.file)).size, 2)
  const gate = readFileSync(new URL('../real-host-tests/run.js', import.meta.url), 'utf8')
  assert.match(gate, /REQUIRED_REAL_HOST_SUITES/)
  const focused = readFileSync(new URL('../real-host-tests/run-sidebar.js', import.meta.url), 'utf8')
  assert.match(focused, /SIDEBAR_SUITE/)
})

test('the unit test glob excludes the real-host contract', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts['test:unit'], 'node --test features/tests/*.test.js')
  assert.equal(pkg.scripts['test:real-host'], 'node features/real-host-tests/run.js')
  assert(existsSync(new URL('../real-host-tests/session-data-access.real-host.test.js', import.meta.url)))
  assert(!existsSync(new URL('./session-data-access.real-host.test.js', import.meta.url)))
})
