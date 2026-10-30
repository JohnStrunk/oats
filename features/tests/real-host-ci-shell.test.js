import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { loadCiWorkflow } from '../steps/workflow_helper.js'

test('real-host CI assertion rejects shell overrides that do not execute the required scripts', async t => {
  const tempRoot = process.env.TMPDIR !== undefined ? tmpdir() : existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const dir = mkdtempSync(join(tempRoot, 'oats-ci-shell-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const require = createRequire(import.meta.url)
  const cucumber = pathToFileURL(require.resolve('@cucumber/cucumber')).href
  const step = new URL('../steps/then/the-ci-test-job-shall-run-the-real-host-contract-test-with-the-installed-pinned-host.js', import.meta.url).pathname
  const fixture = join(dir, 'fixture.mjs')
  const feature = join(dir, 'fixture.feature')
  const config = join(dir, 'cucumber.json')
  writeFileSync(fixture, `import { Given } from ${JSON.stringify(cucumber)}\nGiven('CI workflow fixture {int}', function (index) { this.ci_workflow = JSON.parse(process.env.OATS_CI_FIXTURES)[index]; this.nvmNodeVersion = process.env.OATS_NVM_FIXTURE })\n`)
  writeFileSync(config, JSON.stringify({ default: { import: [fixture, step], format: ['json'] } }))

  const base = loadCiWorkflow()
  const nvmVersion = readFileSync(new URL('../../.nvmrc', import.meta.url), 'utf8').trim()
  const cases = [
    ['implicit default shell', () => {}, true],
    ['explicit workflow bash default', w => { w.defaults = { run: { shell: 'bash' } } }, true],
    ['explicit job sh default', w => { w.jobs.test.defaults = { run: { shell: 'sh' } } }, true],
    ['valid job overrides workflow default', w => {
      w.defaults = { run: { shell: 'true {0}' } }
      w.jobs.test.defaults = { run: { shell: 'bash' } }
    }, true],
    ['valid step overrides job default', w => {
      w.jobs.test.defaults = { run: { shell: 'true {0}' } }
      for (const step of w.jobs.test.steps.filter(s => s.run?.startsWith('npm ci --prefix') || s.run === 'npm run test:real-host')) step.shell = 'bash'
    }, true],
    ['no-op installation shell', w => { w.jobs.test.steps.find(s => s.run?.startsWith('npm ci --prefix')).shell = 'true {0}' }, false],
    ['no-op contract shell', w => { w.jobs.test.steps.find(s => s.run === 'npm run test:real-host').shell = 'true {0}' }, false],
    ['no-op workflow default', w => { w.defaults = { run: { shell: 'true {0}' } } }, false],
    ['no-op job default', w => { w.jobs.test.defaults = { run: { shell: 'true {0}' } } }, false],
    ['null shell override', w => { w.jobs.test.steps.find(s => s.run === 'npm run test:real-host').shell = null }, false],
    ['arbitrary bash command template', w => { w.jobs.test.steps.find(s => s.run === 'npm run test:real-host').shell = 'bash -c true {0}' }, false],
    ['dynamic shell expression', w => { w.jobs.test.steps.find(s => s.run === 'npm run test:real-host').shell = '${{ matrix.shell }}' }, false],
    ['shell on setup action', w => { w.jobs.test.steps.find(s => s.uses?.startsWith('actions/setup-node@')).shell = 'bash' }, false],
  ]
  const workflows = cases.map(([, mutate]) => {
    const workflow = structuredClone(base)
    mutate(workflow)
    return workflow
  })
  writeFileSync(feature, 'Feature: Exercise real-host CI assertion\n' + cases.map((_, index) =>
    `  Scenario: Validate workflow ${index}\n    Given CI workflow fixture ${index}\n    Then the CI test job shall run the real-host contract test with the installed pinned host\n`).join(''))
  const result = spawnSync(process.execPath, [new URL('../../node_modules/@cucumber/cucumber/bin/cucumber.js', import.meta.url).pathname, '--config', relative(process.cwd(), config), feature], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, OATS_CI_FIXTURES: JSON.stringify(workflows), OATS_NVM_FIXTURE: nvmVersion },
  })
  assert.ifError(result.error)
  assert.equal(result.status, 1, `Negative controls must make Cucumber fail: ${result.stderr}`)
  const [report] = JSON.parse(result.stdout)
  assert.equal(report.elements.length, cases.length)
  for (const [index, [name, , expected]] of cases.entries()) {
    const [given, then] = report.elements[index].steps
    assert.equal(given.result.status, 'passed', `${name}: fixture setup failed`)
    assert.equal(then.result.status, expected ? 'passed' : 'failed', name)
    if (!expected) assert.match(then.result.error_message, /shell/i, `${name} failed for an unrelated reason`)
  }
})
