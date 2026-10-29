import assert from 'node:assert/strict'
import test from 'node:test'
import fc from 'fast-check'
import * as ci from '../steps/workflow_helper.js'

const events = [
  { type: 'pull_request', branch: 'main', action: 'opened' },
  { type: 'pull_request', branch: 'main', action: 'synchronize' },
  { type: 'pull_request', branch: 'main', action: 'reopened' },
  { type: 'push', branch: 'main' },
  { type: 'workflow_dispatch' },
]

function checks(workflow) {
  return ci.requiredCiJobIds(workflow)
}

function assertAllScheduled(workflow, event) {
  const ids = checks(workflow)
  assert(ids.length > 0, 'Fixture must declare required jobs')
  const result = ci.evaluateCiScheduling(workflow, event)
  assert.equal(result.triggered, true, JSON.stringify(event))
  for (const id of ids) assert(result.scheduledJobIds.includes(id), `${event.type} did not schedule ${id}`)
}

test('checked-in workflow schedules every configured check for each supported event', () => {
  const workflow = ci.loadCiWorkflow()
  for (const event of events) assertAllScheduled(workflow, event)
})

test('excluding main from either branch filter is detected', () => {
  for (const type of ['pull_request', 'push']) {
    const workflow = structuredClone(ci.loadCiWorkflow())
    const event = events.find(candidate => candidate.type === type)
    assertAllScheduled(workflow, event)
    workflow.on[type].branches = ['release']
    assert.throws(() => assertAllScheduled(workflow, event), 'A branch filter excluding main cannot satisfy the requirement')
  }
})

test('disabling any individual required job is detected for every event', () => {
  const original = ci.loadCiWorkflow()
  for (const id of checks(original)) {
    for (const event of events) {
      const workflow = structuredClone(original)
      assertAllScheduled(workflow, event)
      workflow.jobs[id].if = '${{ false }}'
      assert.throws(() => assertAllScheduled(workflow, event), `${id} with if false cannot satisfy ${event.type}`)
    }
  }
})

test('renaming a required job cannot hide it from scheduling checks', () => {
  const workflow = structuredClone(ci.loadCiWorkflow())
  const [, gate] = ci.findSuccessfulCiJob(workflow)
  assert(gate.needs.includes('lint-shell'), 'Fixture must require lint-shell')
  workflow.jobs['quality-shell'] = workflow.jobs['lint-shell']
  workflow.jobs['quality-shell'].name = 'Shell Quality'
  delete workflow.jobs['lint-shell']
  gate.needs[gate.needs.indexOf('lint-shell')] = 'quality-shell'
  for (const event of events) assertAllScheduled(workflow, event)
  workflow.jobs['quality-shell'].if = '${{ false }}'
  for (const event of events) {
    assert.throws(() => assertAllScheduled(workflow, event), /quality-shell/, `Disabled renamed job must fail ${event.type}`)
  }
})

test('a non-gate job omitted from Successful CI needs fails closed', () => {
  const workflow = structuredClone(ci.loadCiWorkflow())
  workflow.jobs['quality-shell'] = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'true' }] }
  assert.throws(() => checks(workflow), /must be a Successful CI prerequisite.*quality-shell/)
})

test('unsupported event and job constructs cannot silently claim scheduling', () => {
  const workflow = ci.loadCiWorkflow()
  assertAllScheduled(workflow, { type: 'push', branch: 'main' })
  const paths = structuredClone(workflow)
  paths.on.push.paths = ['src/**']
  assert.throws(() => ci.evaluateCiScheduling(paths, { type: 'push', branch: 'main' }))
  const condition = structuredClone(workflow)
  condition.jobs.test.if = '${{ unknown.context }}'
  assert.throws(() => ci.evaluateCiScheduling(condition, { type: 'push', branch: 'main' }))
})

test('extra configured jobs cannot be missed, including when any one is disabled', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 11 }), (count, pick) => {
    const workflow = structuredClone(ci.loadCiWorkflow())
    const [, gate] = ci.findSuccessfulCiJob(workflow)
    for (let i = 0; i < count; i++) {
      for (const kind of ['test', 'lint']) {
        const id = `${kind}_extra_${i}`
        workflow.jobs[id] = { 'runs-on': 'ubuntu-latest', steps: [{ run: 'true' }] }
        gate.needs.push(id)
      }
    }
    for (const event of events) assertAllScheduled(workflow, event)
    const id = [`test_extra_${pick % count}`, `lint_extra_${pick % count}`][pick % 2]
    workflow.jobs[id].if = '${{ false }}'
    assert.throws(() => assertAllScheduled(workflow, events[pick % events.length]), `Missed disabled ${id}`)
  }), { seed: 104729, numRuns: 20 })
})
