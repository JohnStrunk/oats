import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { After, BeforeAll } from '@cucumber/cucumber'
import { cleanupSandbox, populateSandbox, populateDiscoverySandbox, prepareNegativeFixture, sandboxEnvironment } from './migration-sandbox.js'
import { runProcess } from './migration-process.js'
import { assertCompleteInventory } from './migration-inventory.js'
import { requireFixtureScenario } from './migration-fixture-result.js'
import { readBoundedText, MAX_REPORT_BYTES, MAX_PROBE_BYTES } from './migration-output.js'
import { MIGRATION_RUN_TIMEOUT_MS } from './migration-time-budget.js'

// If a fixture runner unexpectedly imports real repository support code, fail
// before any step or host can run, rather than recursively spawning Cucumber.
if (process.env.OATS_MIGRATION_SANDBOX_CHILD === '1') {
  throw new Error('Sandbox child attempted to load repository migration steps')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const originalScenarios = JSON.parse(readFileSync(join(root, 'features/tests/migration-baseline.json'), 'utf8'))

export function assertOriginalScenarios(found, component) {
  for (const [uri, expected] of Object.entries(originalScenarios)) {
    if (!uri.startsWith(`features/${component}/`)) continue
    for (const [line, name, ...exampleSteps] of expected) {
      const matches = found.filter(s => s.uri === uri && s.line === line)
      assert.equal(matches.length, 1, `Missing or duplicate scenario ${uri}:${line}`)
      assert.equal(matches[0].name, name, `Changed scenario at ${uri}:${line}`)
      assert.deepEqual(matches[0].steps.filter(s => !s.hidden).slice(0, exampleSteps.length).map(s => s.name), exampleSteps)
      for (const step of matches[0].steps.filter(s => !s.hidden)) {
        assert.ok(step.match?.location, `Undefined or ambiguous step in ${uri}:${line}: ${step.name}`)
        assert.notEqual(step.result?.status, 'undefined')
        assert.notEqual(step.result?.status, 'ambiguous')
      }
    }
  }
}

export function featureScenarios(report) {
  return report.flatMap(feature => (feature.elements ?? [])
    .filter(element => element.type === 'scenario')
    .map(element => ({ ...element, uri: feature.uri.replaceAll('\\', '/') })))
}

export async function createMigrationFixture(tag) {
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const dir = mkdtempSync(join(tempRoot, 'oats-migration-fixture-'))
  try {
    await populateSandbox(dir, root)
    if (tag) prepareNegativeFixture(dir)
    return { dir, tag }
  } catch (error) {
    cleanupSandbox(dir)
    throw error
  }
}

After(function () {
  if (this.migrationFixture) cleanupSandbox(this.migrationFixture.dir)
})

BeforeAll(function () {
  if (process.env.OATS_MIGRATION_DISCOVERY_CHILD === '1') {
    throw new Error('Discovery child refused scenario execution')
  }
})

export async function runMigrationChild({ dryRun = false, component, fixture, fixtureCase = false } = {}) {
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const dir = mkdtempSync(join(tempRoot, 'oats-migration-report-'))
  try {
    if (dryRun) await populateDiscoverySandbox(dir, root)
    const reportPath = join(dir, 'report.json')
    const args = ['run', 'test:features', '--']
    if (dryRun) args.push('--dry-run')
    if (component) args.push('--tags', `@component:${component}`)
    if (fixtureCase) args.push('--tags', `@contract-${fixture.tag}`)
    args.push('--format', `json:${reportPath}`)
    const probeLog = fixture && join(fixture.dir, 'probe.log')
    const child = await runProcess('npm', args, {
      cwd: fixture ? fixture.dir : dir,
      timeout: MIGRATION_RUN_TIMEOUT_MS,
      env: sandboxEnvironment(fixture ? fixture.dir : dir, { discovery: !fixture, probeLog }),
    })
    assert.equal(child.timedOut, false, 'The feature runner timed out')
    assert.notEqual(child.status, null, 'The feature runner did not exit')
    let report
    try {
      report = JSON.parse(readBoundedText(reportPath, MAX_REPORT_BYTES))
    } catch (error) {
      assert.fail(`The feature runner did not produce JSON: ${error.message}\nexit=${child.status}\n${child.stdout}\n${child.stderr}`)
    }
    assert.ok(Array.isArray(report), 'Cucumber JSON report must be an array')
    if (dryRun) assertCompleteInventory(root, featureScenarios(report), component)
    if (fixtureCase) requireFixtureScenario(featureScenarios(report), fixture.tag)
    return {
      status: child.status, output: child.stdout + child.stderr,
      scenarios: featureScenarios(report),
      probes: probeLog ? readBoundedText(probeLog, MAX_PROBE_BYTES, { optional: true }).trim().split('\n').filter(Boolean) : [],
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
