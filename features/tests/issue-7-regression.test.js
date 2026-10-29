// Independent regression coverage for issue #7, complementing qa-spec's tests.
// It pins what helper-level tests cannot: the Gherkin scenarios fail when the
// checked-in workflow is mutated, and scheduling/linting fail closed.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import * as ci from '../steps/workflow_helper.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cucumber = join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js')
const repoInfrastructure = 'features/repo-infrastructure'
const FAILURE_FEATURE = `${repoInfrastructure}/if-any-configured-test-or-lint-check-job-fails-or-is-cancelled-then-the-ci-workflow-shall-report-a-failure-conclusion-for-the-successful-ci-job.feature`
const SKIPPED_FEATURE = `${repoInfrastructure}/if-a-configured-test-or-lint-check-job-is-skipped-then-the-ci-workflow-shall-report-a-failure-conclusion-for-the-successful-ci-job.feature`
const SCHEDULING_FEATURE = `${repoInfrastructure}/when-a-pull-request-targeting-main-a-push-to-main-or-a-workflow-dispatch-event-occurs-the-ci-workflow-shall-execute-all-configured-automated-test-and-lint-check-jobs.feature`

function temporaryDirectory(t) {
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-issue-7-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

// Build a disposable checkout so a workflow mutation cannot touch the real file.
function prepareRepository(t, mutateWorkflow = workflow => workflow) {
  const dir = temporaryDirectory(t)
  cpSync(join(root, 'features/steps'), join(dir, 'features/steps'), { recursive: true })
  cpSync(join(root, 'features/tests'), join(dir, 'features/tests'), { recursive: true })
  for (const feature of [FAILURE_FEATURE, SKIPPED_FEATURE, SCHEDULING_FEATURE]) {
    mkdirSync(dirname(join(dir, feature)), { recursive: true })
    cpSync(join(root, feature), join(dir, feature))
  }
  mkdirSync(join(dir, '.github/workflows'), { recursive: true })
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
  const mutated = mutateWorkflow(workflow)
  assert.equal(typeof mutated, 'string', 'Workflow mutation must return YAML text')
  writeFileSync(join(dir, '.github/workflows/ci.yml'), mutated)
  writeFileSync(join(dir, 'package.json'), '{"type":"module","private":true}\n')
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  return dir
}

function runFeatures(dir, features, name) {
  const report = join(dir, 'report.json')
  const args = [cucumber, ...features.map(feature => join(dir, feature))]
  if (name) args.push('--name', name)
  args.push('--import', 'features/steps/given/*.js',
    '--import', 'features/steps/when/*.js',
    '--import', 'features/steps/then/*.js',
    '--format', `json:${report}`)
  const child = spawnSync(process.execPath, args, {
    cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, LANG: 'C' },
  })
  assert.ifError(child.error)
  assert.equal(child.signal, null, `Cucumber terminated by ${child.signal}`)
  assert(existsSync(report), `Cucumber did not write a report:\n${child.stdout}\n${child.stderr}`)
  const scenarios = JSON.parse(readFileSync(report, 'utf8')).flatMap(featureReport => featureReport.elements ?? [])
    .filter(element => element.type === 'scenario')
  assert(scenarios.length > 0, 'Cucumber did not execute any scenario')
  return { status: child.status, scenarios }
}

function failingMessages(run) {
  return run.scenarios.flatMap(scenario => scenario.steps)
    .filter(step => !step.hidden && step.result.status === 'failed')
    .map(step => step.result.error_message)
}

function assertScenarioFails(run, message) {
  assert.equal(run.status, 1, 'Mutated workflow must fail the Gherkin scenario')
  const failures = failingMessages(run)
  assert(failures.length > 0, 'Expected a failing step')
  assert.match(failures.join('\n'), message)
}

test('unmutated checked-in workflow passes the gate and scheduling scenarios end to end', t => {
  const dir = prepareRepository(t)
  const run = runFeatures(dir, [FAILURE_FEATURE, SKIPPED_FEATURE, SCHEDULING_FEATURE])
  assert.equal(run.status, 0, failingMessages(run).join('\n'))
})

test('mutating the failure branch to exit 0 is caught end to end', t => {
  const dir = prepareRepository(t, workflow => {
    assert.match(workflow, /exit 1/)
    return workflow.replace('exit 1', 'exit 0')
  })
  assertScenarioFails(runFeatures(dir, [FAILURE_FEATURE], '^A test job fails$'), /Expected gate conclusion 'failure'/)
})

test('removing the skipped and cancelled gate checks is caught end to end', t => {
  const fragments = [" || contains(needs.*.result, 'skipped')", " || contains(needs.*.result, 'cancelled')"]
  const dir = prepareRepository(t, workflow => {
    for (const fragment of fragments) assert.ok(workflow.includes(fragment), `Gate must contain ${fragment}`)
    return fragments.reduce((text, fragment) => text.replace(fragment, ''), workflow)
  })
  const run = runFeatures(dir, [FAILURE_FEATURE, SKIPPED_FEATURE])
  assertScenarioFails(run, /Expected gate conclusion 'failure'/)
  assert.equal(failingMessages(run).length, 2, 'Cancelled and skipped scenarios must each fail')
})

test('a branch filter excluding main is caught end to end', t => {
  const dir = prepareRepository(t, workflow => {
    assert.match(workflow, /branches: \[main\]/)
    return workflow.replaceAll('branches: [main]', 'branches: [release]')
  })
  assertScenarioFails(runFeatures(dir, [SCHEDULING_FEATURE], '^CI workflow triggers on direct push to main$'), /was not triggered/)
})

test('a job condition disabling a required lint job is caught end to end', t => {
  const dir = prepareRepository(t, workflow => {
    assert.match(workflow, /\n {2}lint-shell:\n/)
    return workflow.replace('\n  lint-shell:\n', '\n  lint-shell:\n    if: ${{ false }}\n')
  })
  assertScenarioFails(runFeatures(dir, [SCHEDULING_FEATURE], '^CI workflow triggers on pull request targeting main$'), /Required CI job lint-shell was not scheduled/)
})

test('a renamed required job is still discovered and a disabled one is caught end to end', t => {
  const dir = prepareRepository(t, workflow => {
    assert.match(workflow, /\n {2}lint-shell:\n    name: Lint Shell Scripts\n/)
    assert.match(workflow, /\n {6}- lint-shell\n/)
    return workflow
      .replace('\n  lint-shell:\n    name: Lint Shell Scripts\n', '\n  quality-shell:\n    name: Shell Quality\n    if: ${{ false }}\n')
      .replace('      - lint-shell\n', '      - quality-shell\n')
  })
  assertScenarioFails(runFeatures(dir, [SCHEDULING_FEATURE], '^CI workflow triggers on direct push to main$'), /Required CI job quality-shell was not scheduled/)
})

test('a job omitted from the Successful CI prerequisites is caught end to end', t => {
  const dir = prepareRepository(t, workflow => {
    assert.match(workflow, /\n {6}- lint-shell\n/)
    return workflow.replace('      - lint-shell\n', '')
  })
  assertScenarioFails(runFeatures(dir, [SCHEDULING_FEATURE], '^CI workflow triggers on manual workflow dispatch$'), /must be a Successful CI prerequisite: lint-shell/)
})

function checkJobs(workflow) {
  return ci.requiredCiJobIds(workflow)
}

test('a non-matching branch or pull request action reports no scheduled jobs', () => {
  const workflow = ci.loadCiWorkflow()
  const expected = { triggered: false, scheduledJobIds: [] }
  assert.deepEqual(ci.evaluateCiScheduling(workflow, { type: 'push', branch: 'feature/topic' }), expected)
  assert.deepEqual(ci.evaluateCiScheduling(workflow, { type: 'pull_request', branch: 'release', action: 'opened' }), expected)
  assert.deepEqual(ci.evaluateCiScheduling(workflow, { type: 'pull_request', branch: 'main', action: 'closed' }), expected)
})

test('pull request types restrict which actions schedule checks', () => {
  const workflow = structuredClone(ci.loadCiWorkflow())
  workflow.on.pull_request.types = ['opened']
  assert.deepEqual(ci.evaluateCiScheduling(workflow, { type: 'pull_request', branch: 'main', action: 'synchronize' }),
    { triggered: false, scheduledJobIds: [] })
  const opened = ci.evaluateCiScheduling(workflow, { type: 'pull_request', branch: 'main', action: 'opened' })
  assert.equal(opened.triggered, true)
  for (const id of checkJobs(workflow)) assert(opened.scheduledJobIds.includes(id), `${id} was not scheduled`)
})

test('workflow dispatch is independent of branch filters configured for other events', () => {
  const workflow = structuredClone(ci.loadCiWorkflow())
  workflow.on.push.branches = ['release']
  workflow.on.pull_request.branches = ['release']
  const result = ci.evaluateCiScheduling(workflow, { type: 'workflow_dispatch' })
  assert.equal(result.triggered, true)
  for (const id of checkJobs(workflow)) assert(result.scheduledJobIds.includes(id), `${id} was not scheduled`)
})

test('malformed scheduling inputs fail closed instead of claiming jobs', () => {
  const workflow = ci.loadCiWorkflow()
  assert.throws(() => ci.evaluateCiScheduling(workflow, { type: 'schedule' }), /Unsupported event/)
  assert.throws(() => ci.evaluateCiScheduling(workflow, { type: 'push' }), /branch required/i)
  assert.throws(() => ci.evaluateCiScheduling(workflow, { type: 'pull_request', branch: 'main' }), /action required/i)
  const untriggered = structuredClone(workflow)
  delete untriggered.on
  assert.throws(() => ci.evaluateCiScheduling(untriggered, { type: 'push', branch: 'main' }), /trigger/i)
})

test('a disabled job is omitted while the remaining configured checks stay scheduled', () => {
  const workflow = structuredClone(ci.loadCiWorkflow())
  workflow.jobs['lint-shell'].if = false
  const result = ci.evaluateCiScheduling(workflow, { type: 'push', branch: 'main' })
  assert.equal(result.triggered, true)
  assert(!result.scheduledJobIds.includes('lint-shell'), 'Disabled job must not be reported as scheduled')
  for (const id of checkJobs(workflow).filter(id => id !== 'lint-shell')) {
    assert(result.scheduledJobIds.includes(id), `${id} must remain scheduled`)
  }
})

function writeFixture(directory, path, contents) {
  const target = join(directory, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

test('unknown linter kinds and malformed invocations are rejected', t => {
  const dir = temporaryDirectory(t)
  assert.throws(() => ci.runCiLinter('eslint', { cwd: dir }), /Invalid linter/)
  assert.throws(() => ci.runCiLinter('markdownlint'), /Invalid linter/)
  assert.throws(() => ci.runCiLinter('markdownlint', { cwd: 42 }), /Invalid linter/)
  assert.throws(() => ci.runCiLinter('markdownlint', { cwd: dir, files: [42] }), /Invalid linter file list/)
  assert.throws(() => ci.runCiLinter('markdownlint', { cwd: dir, files: ['/absolute.md'] }), /Invalid linter file list/)
  const optionLike = ci.runCiLinter('markdownlint', { cwd: dir, files: ['--fix'] })
  assert.notEqual(optionLike.status, 0, 'An option-like filename must be treated as a missing literal path, not a flag')
})

test('a mixed file set fails when any file violates markdownlint', t => {
  const dir = temporaryDirectory(t)
  writeFixture(dir, 'clean-a.md', '# A\n\nText.\n')
  writeFixture(dir, 'clean-b.md', '# B\n\nText.\n')
  writeFixture(dir, 'fence.md', '# C\n\n```\ncode\n```\n')
  const clean = ci.runCiLinter('markdownlint', { cwd: dir, files: ['clean-a.md', 'clean-b.md'] })
  assert.equal(clean.status, 0, `${clean.stdout}\n${clean.stderr}`)
  const mixed = ci.runCiLinter('markdownlint', { cwd: dir, files: ['clean-a.md', 'fence.md', 'clean-b.md'] })
  assert.notEqual(mixed.status, 0, 'A violating file in the set must fail the run')
  assert.match(`${mixed.stdout}\n${mixed.stderr}`, /MD040/, 'Failure must be a markdownlint diagnostic')
})

test('shellcheck reports a syntax error as a lint failure', t => {
  const dir = temporaryDirectory(t)
  writeFixture(dir, 'broken.sh', '#!/bin/sh\nif true; then\n')
  const result = ci.runCiLinter('shellcheck', { cwd: dir, files: ['broken.sh'] })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /SC10(?:72|73)/, 'Failure must be a shellcheck syntax diagnostic')
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /ENOENT/)
})

function commandAvailable(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0
}

const CLEAN_WORKFLOW = 'name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n'
const toolFixtures = [
  { kind: 'yamllint', command: 'yamllint', path: 'tab.yml', clean: 'key: value\n', bad: '\tkey: value\n', diagnostic: /syntax error/i },
  { kind: 'actionlint', command: 'actionlint', path: '.github/workflows/expr.yml', clean: CLEAN_WORKFLOW,
    bad: CLEAN_WORKFLOW.replace('runs-on: ubuntu-latest', 'runs-on: ${{ matrix.os }}'), diagnostic: /matrix\.os|property "os"/ },
]

for (const fixture of toolFixtures) {
  test(`${fixture.kind} rejects a negative fixture`, { skip: !commandAvailable(fixture.command) && `missing ${fixture.command}` }, t => {
    const dir = temporaryDirectory(t)
    writeFixture(dir, fixture.path, fixture.bad)
    const bad = ci.runCiLinter(fixture.kind, { cwd: dir, files: [fixture.path] })
    assert.notEqual(bad.status, 0, `Invalid fixture must fail: ${bad.stdout}\n${bad.stderr}`)
    assert.match(`${bad.stdout}\n${bad.stderr}`, fixture.diagnostic, 'Failure must be a linter diagnostic')
    writeFixture(dir, fixture.path, fixture.clean)
    const clean = ci.runCiLinter(fixture.kind, { cwd: dir, files: [fixture.path] })
    assert.equal(clean.status, 0, `Clean fixture must pass: ${clean.stdout}\n${clean.stderr}`)
  })
}
