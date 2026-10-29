import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  executeSuccessfulCiGate,
  findSuccessfulCiJob,
  loadCiWorkflow,
  workflowWithSyntheticChecks,
} from '../steps/workflow_helper.js'
import { gateProperty, successGateProperty, successResults, assertGeneratedGateSuccessOnce } from '../steps/workflow_gate_property.js'
import { runProcess } from './migration-process.js'
import { readBoundedText, MAX_REPORT_BYTES } from './migration-output.js'

const root = fileURLToPath(new URL('../../', import.meta.url))

function successMutant(workflow) {
  const mutant = structuredClone(workflow)
  const [, gate] = findSuccessfulCiJob(mutant)
  const fragment = "contains(needs.*.result, 'failure')"
  const original = gate.steps[0].run
  gate.steps[0].run = original.replace(fragment, `needs.test_job_5.result == 'success' || ${fragment}`)
  assert.notEqual(gate.steps[0].run, original, 'Mutation must modify the gate')
  return mutant
}

function temporaryDirectory(t) {
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-gate-property-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('generated prerequisite counts and results preserve the CI gate invariant', () => {
  const workflow = loadCiWorkflow()
  const snapshot = structuredClone(workflow)
  fc.assert(gateProperty(workflow), {
    // 32 generated/example cases, at most three actual bash invocations each;
    // the seed makes the randomized run reproducible in CI.
    seed: 104729,
    numRuns: 32,
    endOnFailure: true,
    examples: [
      [{ test: 0, lint: 1 }, 'failure', 0, successResults],
      [{ test: 1, lint: 0 }, 'cancelled', 0, successResults],
      [{ test: 6, lint: 6 }, 'skipped', 11, successResults],
      [{ test: 6, lint: 6 }, 'failure', 0, successResults],
    ],
  })
  assert.deepEqual(workflow, snapshot, 'Generating contexts must not mutate the checked-in workflow')
})

test('generated single-fault cases reject omitted gate checks', () => {
  const fragments = {
    failure: "contains(needs.*.result, 'failure') || ",
    cancelled: " || contains(needs.*.result, 'cancelled')",
    skipped: " || contains(needs.*.result, 'skipped')",
  }
  for (const [missing, fragment] of Object.entries(fragments)) {
    const mutant = structuredClone(loadCiWorkflow())
    const [, gate] = findSuccessfulCiJob(mutant)
    const original = gate.steps[0].run
    gate.steps[0].run = original.replace(fragment, '')
    assert.notEqual(gate.steps[0].run, original, `Mutation must remove the ${missing} check`)
    const result = fc.check(gateProperty(mutant), {
      seed: 104729,
      numRuns: 1,
      endOnFailure: true,
      examples: [[{ test: 1, lint: 1 }, missing, 1, successResults]],
    })
    assert.equal(result.failed, true, `The property must reject a gate missing ${missing}`)
    assert.ok(result.errorInstance instanceof assert.AssertionError, 'Failure must come from an outcome assertion')
    assert.equal(result.errorInstance.actual, 'success')
    assert.equal(result.errorInstance.expected, 'failure')
  }
})

test('success property catches a gate defect beyond the three fixed examples', () => {
  const mutant = successMutant(loadCiWorkflow())
  for (const counts of [{ test: 1, lint: 1 }, { test: 2, lint: 3 }, { test: 5, lint: 1 }]) {
    assert.equal(executeSuccessfulCiGate(workflowWithSyntheticChecks(mutant, counts), {}), 'success')
  }
  const result = fc.check(successGateProperty(mutant), {
    numRuns: 1, endOnFailure: true, examples: [[{ test: 6, lint: 1 }]],
  })
  assert.equal(result.failed, true)
  assert.ok(result.errorInstance instanceof assert.AssertionError)
  assert.equal(result.errorInstance.actual, 'failure')
  assert.equal(result.errorInstance.expected, 'success')
})

test('successful property verification is reused only for the same workflow', t => {
  const dir = temporaryDirectory(t)
  const marker = join(dir, 'executions')
  const workflow = structuredClone(loadCiWorkflow())
  const [, gate] = findSuccessfulCiJob(workflow)
  gate.steps[0].run = `printf 'run\\n' >> ${JSON.stringify(marker)}\n${gate.steps[0].run}`
  assertGeneratedGateSuccessOnce(workflow)
  assertGeneratedGateSuccessOnce(workflow)
  assert.equal(readFileSync(marker, 'utf8').trim().split('\n').length, 32)
  assert.throws(() => assertGeneratedGateSuccessOnce(successMutant(workflow)), error =>
    error.cause instanceof assert.AssertionError && error.cause.message.includes('All-success gate'))
})

test('the Gherkin outline runs the generated property after its fixed-case gate', async t => {
  const dir = temporaryDirectory(t)
  for (const folder of ['features/steps/given', 'features/steps/when', 'features/steps/then', 'features/repo-infrastructure', '.github/workflows']) {
    mkdirSync(join(dir, folder), { recursive: true })
  }
  for (const path of [
    'features/steps/workflow_helper.js',
    'features/steps/ci_scheduling.js',
    'features/steps/ci_linter.js',
    'features/steps/workflow_gate_property.js',
    'features/steps/given/n-test-jobs-have-completed-with-conclusion-success.js',
    'features/steps/given/n-lint-jobs-have-completed-with-conclusion-success.js',
    'features/steps/when/the-ci-workflow-evaluates-the-aggregate-prerequisite-status.js',
    'features/steps/then/the-successful-ci-job-conclusion-shall-be-status.js',
    'features/repo-infrastructure/when-all-configured-test-and-lint-check-jobs-complete-successfully-the-ci-workflow-shall-report-a-successful-conclusion-for-the-successful-ci-job.feature',
  ]) copyFileSync(join(root, path), join(dir, path))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module', private: true }))
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
  const fragment = "contains(needs.*.result, 'failure')"
  const mutated = workflow.replace(fragment, `needs.test_job_5.result == 'success' || ${fragment}`)
  assert.notEqual(mutated, workflow)
  writeFileSync(join(dir, '.github/workflows/ci.yml'), mutated)
  const report = join(dir, 'report.json')
  const cli = join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js')
  const child = await runProcess(process.execPath, [cli,
    'features/repo-infrastructure/when-all-configured-test-and-lint-check-jobs-complete-successfully-the-ci-workflow-shall-report-a-successful-conclusion-for-the-successful-ci-job.feature',
    '--import', 'features/steps/given/*.js', '--import', 'features/steps/when/*.js',
    '--import', 'features/steps/then/*.js', '--name', '^Invariant aggregate success across varying job combinations$',
    '--format', `json:${report}`,
  ], { cwd: dir, env: process.env, timeout: 60000 })
  assert.equal(child.timedOut, false)
  assert.equal(child.status, 1, `${child.stdout}\n${child.stderr}`)
  const scenarios = JSON.parse(readBoundedText(report, MAX_REPORT_BYTES)).flatMap(feature => feature.elements ?? [])
  assert.equal(scenarios.length, 3, 'All fixed outline examples must execute')
  for (const scenario of scenarios) {
    const steps = scenario.steps.filter(step => !step.hidden)
    assert.deepEqual(steps.slice(0, -1).map(step => step.result.status), ['passed', 'passed', 'passed'])
    assert.equal(steps.at(-1).result.status, 'failed')
    assert.match(steps.at(-1).result.error_message, /All-success gate/)
  }
})
