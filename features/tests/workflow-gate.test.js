import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateGateExpression, executeSuccessfulCiGate, findSuccessfulCiJob, loadCiWorkflow, workflowWithSyntheticChecks } from '../steps/workflow_helper.js'

test('checked-in gate shell handles each prerequisite conclusion', () => {
  const workflow = loadCiWorkflow()
  const [, job] = findSuccessfulCiJob(workflow)
  assert.equal(executeSuccessfulCiGate(workflow, {}), 'success')
  for (const id of job.needs) {
    for (const status of ['failure', 'cancelled', 'skipped']) {
      assert.equal(executeSuccessfulCiGate(workflow, { [id]: status }), 'failure', `${id}: ${status}`)
    }
  }
})

test('changing the workflow expression changes the observed outcome', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  const original = job.steps[0].run
  job.steps[0].run = original.replace("contains(needs.*.result, 'failure') || ", '')
  assert.notEqual(job.steps[0].run, original)
  assert.equal(executeSuccessfulCiGate(workflow, { test: 'failure' }), 'success')
})

test('changing the workflow shell exit changes the observed outcome', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  const original = job.steps[0].run
  job.steps[0].run = original.replace('exit 1', 'exit 0')
  assert.notEqual(job.steps[0].run, original)
  assert.equal(executeSuccessfulCiGate(workflow, { test: 'failure' }), 'success')
})

test('a mutant that ignores lint-shell failure is detected', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  const original = job.steps[0].run
  job.steps[0].run = original.replace(
    "contains(needs.*.result, 'failure')",
    "needs.test.result == 'failure' || needs['lint-markdown'].result == 'failure' || needs['lint-yaml-and-workflows'].result == 'failure'",
  )
  assert.notEqual(job.steps[0].run, original)
  assert.equal(executeSuccessfulCiGate(workflow, { test: 'failure' }), 'failure')
  assert.equal(executeSuccessfulCiGate(workflow, { 'lint-shell': 'failure' }), 'success')
})

test('removing any failure, cancellation or skip check changes the outcome', () => {
  const mutations = {
    failure: "contains(needs.*.result, 'failure') || ",
    cancelled: " || contains(needs.*.result, 'cancelled')",
    skipped: " || contains(needs.*.result, 'skipped')",
  }
  for (const [status, fragment] of Object.entries(mutations)) {
    const workflow = structuredClone(loadCiWorkflow())
    const [, job] = findSuccessfulCiJob(workflow)
    const original = job.steps[0].run
    job.steps[0].run = original.replace(fragment, '')
    assert.notEqual(job.steps[0].run, original, status)
    for (const id of job.needs) {
      assert.equal(executeSuccessfulCiGate(workflow, { [id]: status }), 'success', `${id}: ${status}`)
    }
  }
})

test('shell, environment and container overrides cannot change how the gate runs', () => {
  const overrides = [
    workflow => { workflow.defaults = { run: { shell: 'bash' } } },
    workflow => { workflow.env = { BASH_ENV: '/tmp/injected.sh' } },
    workflow => { workflow.env = {} },
    workflow => { findSuccessfulCiJob(workflow)[1].defaults = { run: { shell: 'bash' } } },
    workflow => { findSuccessfulCiJob(workflow)[1].env = { BASH_ENV: '/tmp/injected.sh' } },
    workflow => { findSuccessfulCiJob(workflow)[1]['continue-on-error'] = false },
    workflow => { findSuccessfulCiJob(workflow)[1].container = { image: 'node:24' } },
    workflow => { workflow.container = 'node:24' },
  ]
  for (const mutate of overrides) {
    const workflow = structuredClone(loadCiWorkflow())
    mutate(workflow)
    assert.throws(() => executeSuccessfulCiGate(workflow, {}), /execution settings|container/)
  }
})

test('a step-level working-directory is rejected instead of silently ignored', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  job.steps[0].run = 'exit 0\n'
  job.steps[0]['working-directory'] = 'features'
  assert.throws(() => executeSuccessfulCiGate(workflow, {}), /Unsupported Successful CI gate step setting: working-directory/)
  delete job.steps[0]['working-directory']
  assert.equal(executeSuccessfulCiGate(workflow, {}), 'success')
})

test('gate runs in an empty workspace without repository files', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  job.steps[0].run = 'test -f package.json\nexit 0\n'
  // A gate that requires a checked-in file must fail: the Successful CI job
  // has no checkout, so running it from the repository would falsely pass.
  assert.equal(executeSuccessfulCiGate(workflow, {}), 'failure')
  assert.equal(executeSuccessfulCiGate(loadCiWorkflow(), {}), 'success')
})

test('additional gate steps that could populate the workspace fail closed', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  job.steps.unshift({ name: 'Check out repository', uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1' })
  assert.equal(job.steps.length, 2)
  assert.throws(() => executeSuccessfulCiGate(workflow, {}), /Expected one Successful CI gate step/)
})

test('other step-level execution overrides fail closed', () => {
  for (const [key, value] of [
    ['shell', 'bash'],
    ['env', { BASH_ENV: '/tmp/injected.sh' }],
    ['if', 'always()'],
    ['continue-on-error', false],
    ['uses', './.github/actions/gate'],
  ]) {
    const workflow = structuredClone(loadCiWorkflow())
    findSuccessfulCiJob(workflow)[1].steps[0][key] = value
    assert.throws(() => executeSuccessfulCiGate(workflow, {}), /Unsupported Successful CI gate step setting/, key)
  }
})

test('runners that would not use implicit Linux bash are rejected', () => {
  for (const runsOn of ['windows-latest', 'macos-15', 'self-hosted', '${{ matrix.os }}', ['ubuntu-latest'], '', 42]) {
    const workflow = structuredClone(loadCiWorkflow())
    const [, job] = findSuccessfulCiJob(workflow)
    job['runs-on'] = runsOn
    assert.throws(() => executeSuccessfulCiGate(workflow, {}), /Ubuntu runner/, JSON.stringify(runsOn))
  }
  const workflow = structuredClone(loadCiWorkflow())
  delete findSuccessfulCiJob(workflow)[1]['runs-on']
  assert.throws(() => executeSuccessfulCiGate(workflow, {}), /Ubuntu runner/)
})

test('other plain Ubuntu runners still execute the gate', () => {
  for (const runsOn of ['ubuntu-22.04', 'ubuntu-24.04', 'ubuntu-24.04-arm']) {
    const workflow = structuredClone(loadCiWorkflow())
    findSuccessfulCiJob(workflow)[1]['runs-on'] = runsOn
    assert.equal(executeSuccessfulCiGate(workflow, {}), 'success', runsOn)
  }
})

test('implicit Linux bash does not enable pipefail', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  job.steps[0].run = 'false | true\nexit 0\n'
  assert.equal(executeSuccessfulCiGate(workflow, {}), 'success')
})

test('a read cannot consume the following gate script command', () => {
  const workflow = structuredClone(loadCiWorkflow())
  const [, job] = findSuccessfulCiJob(workflow)
  job.steps[0].run = 'read -r ignored || true\nexit 1\n'
  assert.equal(executeSuccessfulCiGate(workflow, {}), 'failure')
})

test('unsupported expressions, context values and scheduling fail closed', () => {
  assert.throws(() => evaluateGateExpression('true || github.event.payload', { test: 'success' }))
  assert.throws(() => evaluateGateExpression("contains(needs.*.result, 'failure') ||", { test: 'success' }))
  assert.throws(() => evaluateGateExpression("'unsafe string'", { test: 'success' }), /Boolean/)
  const workflow = loadCiWorkflow()
  assert.throws(() => executeSuccessfulCiGate(workflow, { test: 'success"; touch /tmp/injected; #' }), /Unsupported prerequisite/)
  assert.throws(() => executeSuccessfulCiGate(workflow, { unrelated: 'failure' }), /outside Successful CI needs/)
  const [, job] = findSuccessfulCiJob(workflow)
  job.if = 'always() && false'
  assert.throws(() => executeSuccessfulCiGate(workflow, { test: 'failure' }), /if: always/)
})

test('the gate must depend on every non-gate job', () => {
  const workflow = loadCiWorkflow()
  const [, job] = findSuccessfulCiJob(workflow)
  job.needs = job.needs.filter(id => id !== 'lint-markdown')
  assert.throws(() => executeSuccessfulCiGate(workflow, { test: 'success' }), /must be a Successful CI prerequisite: lint-markdown/)
})

test('outline fixtures have exactly the generated needs and run the original gate', () => {
  const original = loadCiWorkflow()
  const originalSnapshot = structuredClone(original)
  const [, originalGate] = findSuccessfulCiJob(original)
  for (const counts of [{ test: 1, lint: 1 }, { test: 2, lint: 3 }, { test: 5, lint: 1 }, { test: 0, lint: 1 }]) {
    const fixture = workflowWithSyntheticChecks(original, counts)
    const [, gate] = findSuccessfulCiJob(fixture)
    const expected = ['test', 'lint'].flatMap(kind => Array.from({ length: counts[kind] }, (_, i) => `${kind}_job_${i}`))
    assert.deepEqual(gate.needs, expected)
    assert.equal(gate.if, originalGate.if)
    assert.deepEqual(gate.steps, originalGate.steps)
    assert(expected.every(id => Object.hasOwn(fixture.jobs, id)))
    assert.equal(executeSuccessfulCiGate(fixture, {}), 'success')
    for (const id of expected) {
      assert.equal(executeSuccessfulCiGate(fixture, { [id]: 'failure' }), 'failure', id)
    }
  }
  assert.deepEqual(original, originalSnapshot, 'Fixture must not change the checked-in workflow object')
  assert.throws(() => executeSuccessfulCiGate(original, { test_job_0: 'failure' }), /outside Successful CI needs/)
})
