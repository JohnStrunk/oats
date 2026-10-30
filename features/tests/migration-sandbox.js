// Disposable test checkouts limit accidental host use and recursion. They are
// not OS privilege isolation: child code retains the caller's OS permissions.
import assert from 'node:assert/strict'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function sandboxEnvironment(dir, { discovery = false, probeLog } = {}) {
  const home = join(dir, 'home')
  const config = join(dir, 'xdg-config')
  const data = join(dir, 'xdg-data')
  const cache = join(dir, 'xdg-cache')
  const state = join(dir, 'xdg-state')
  const runtime = join(dir, 'xdg-runtime')
  const temp = join(dir, 'tmp')
  for (const path of [home, config, data, cache, state, runtime, temp]) mkdirSync(path, { recursive: true, mode: 0o700 })
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LC_ALL: 'C.UTF-8', HOME: home, TMPDIR: temp,
    XDG_CONFIG_HOME: config, XDG_DATA_HOME: data, XDG_CACHE_HOME: cache,
    XDG_STATE_HOME: state, XDG_RUNTIME_DIR: runtime,
    OATS_OPENCODE: join(dir, 'blocked-host'),
    OPENCODE_DISABLE_PROJECT_CONFIG: '1', OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    ...(discovery ? { OATS_MIGRATION_DISCOVERY_CHILD: '1' } : { OATS_MIGRATION_SANDBOX_CHILD: '1' }),
    ...(probeLog ? { OATS_SANDBOX_PROBE_LOG: probeLog } : {}),
  }
}

export async function populateSandbox(dir, root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  // Reject wrappers with hardcoded paths or additional commands: a nested
  // process must never be able to start the real checkout's scenarios.
  assert.equal(pkg.scripts?.['test:features']?.trim(), 'cucumber-js', 'Unsafe feature runner script for sandbox')
  const configuration = (await import(pathToFileURL(join(root, 'cucumber.js')).href)).default
  assert.ok(Object.keys(configuration).every(key => ['import', 'paths'].includes(key)), 'Unsafe sandbox Cucumber configuration')
  // Omitted paths mean Cucumber's built-in features/**/*.feature default.
  for (const values of [configuration.paths ?? ['features/**/*.feature'], configuration.import]) {
    assert.ok(Array.isArray(values) && values.length > 0, 'Cucumber paths must be explicit')
    for (const value of values) {
      assert.ok(typeof value === 'string' && value.startsWith('features/') && !value.includes('..'),
        `Unsafe sandbox path: ${value}`)
    }
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, type: pkg.type, scripts: { 'test:features': pkg.scripts['test:features'] } }))
  copyFileSync(join(root, 'cucumber.js'), join(dir, 'cucumber.js'))
  symlinkSync(resolve(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  for (const component of ['plugin-ui', 'repo-infrastructure']) {
    const folder = join(dir, 'features', component)
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'probe.feature'), `@component:${component}
Feature: ${component} probe
  Scenario: ${component} probe runs
    Given the "${component}" sandbox probe records execution
`)
  }
  const steps = join(dir, 'features', 'steps', 'given')
  mkdirSync(steps, { recursive: true })
  writeFileSync(join(steps, 'sandbox-probe.js'), `import { Given } from '@cucumber/cucumber'
import { appendFileSync } from 'node:fs'
Given('the {string} sandbox probe records execution', function (component) {
  appendFileSync(process.env.OATS_SANDBOX_PROBE_LOG, component + '\\n')
})
`)
}

// Negative fixtures run through the copied default configuration, not a
// special Cucumber profile. They are created only for negative-path cases.
export function prepareNegativeFixture(dir) {
  const fixtureDir = join(dir, 'features', 'fixtures')
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(join(fixtureDir, 'failure.feature'), `Feature: Isolated fixture
  @contract-failure
  Scenario: Failing scenario
    Given a rejected fixture
  @contract-undefined
  Scenario: Undefined scenario
    Given an undefined fixture
`)
  writeFileSync(join(dir, 'features/steps/given/contract-failure.js'), `import { Given } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Given('a rejected fixture', function () { assert.equal(1, 2, 'intentional assertion failure') })
`)
}

export function cleanupSandbox(dir) {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

// Discovery imports the actual support graph, including static imports of
// application modules. Copy both trees so those imports resolve inside the
// disposable checkout; the host binary remains blocked and the BeforeAll
// guard still refuses any scenario execution in a discovery child.
export async function populateDiscoverySandbox(dir, root) {
  await populateSandbox(dir, root)
  rmSync(join(dir, 'features'), { recursive: true, force: true })
  cpSync(join(root, 'features'), join(dir, 'features'), { recursive: true })
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true })
  // The root tui.js is the package's public entrypoint; acceptance steps import
  // it directly so the sandbox must expose the same entrypoint as a copy.
  copyFileSync(join(root, 'tui.js'), join(dir, 'tui.js'))
}
