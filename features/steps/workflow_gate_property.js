import assert from 'node:assert/strict'
import fc from 'fast-check'
import { executeSuccessfulCiGate, findSuccessfulCiJob, workflowWithSyntheticChecks } from './workflow_helper.js'

// Vary only the prerequisite context/topology. Each assertion executes the
// checked-in gate expression and shell, not a mock of their outcome.
const count = fc.record({ test: fc.integer({ min: 0, max: 6 }), lint: fc.integer({ min: 0, max: 6 }) })
  .filter(({ test, lint }) => test + lint > 0)
const status = fc.constantFrom('failure', 'cancelled', 'skipped')
const position = fc.integer({ min: 0, max: 100 })
const otherResults = fc.array(fc.constantFrom('success', 'failure', 'cancelled', 'skipped'), { minLength: 12, maxLength: 12 })
export const successResults = Array(12).fill('success')

function generatedFixture(workflow, counts) {
  const fixture = workflowWithSyntheticChecks(workflow, counts)
  const [, gate] = findSuccessfulCiJob(fixture)
  const expectedIds = ['test', 'lint'].flatMap(kind =>
    Array.from({ length: counts[kind] }, (_, index) => `${kind}_job_${index}`))
  assert.deepEqual(gate.needs, expectedIds, 'Generated topology must include every prerequisite')
  return { fixture, expectedIds }
}

export function successGateProperty(workflow) {
  return fc.property(count, counts => {
    const { fixture } = generatedFixture(workflow, counts)
    assert.equal(executeSuccessfulCiGate(fixture, {}), 'success', 'All-success gate')
  })
}

export function gateProperty(workflow) {
  return fc.property(count, status, position, otherResults, (counts, unsuccessful, selected, other) => {
    const { fixture, expectedIds } = generatedFixture(workflow, counts)
    assert.equal(executeSuccessfulCiGate(fixture, {}), 'success', 'All-success gate')
    const selectedId = expectedIds[selected % expectedIds.length]
    assert.equal(executeSuccessfulCiGate(fixture, { [selectedId]: unsuccessful }), 'failure',
      `Gate ignored ${unsuccessful} for ${selectedId}`)
    const mixed = Object.fromEntries(expectedIds.map((id, index) => [id, other[index]]))
    mixed[selectedId] = unsuccessful
    assert.equal(executeSuccessfulCiGate(fixture, mixed), 'failure', 'Mixed-result gate')
  })
}

let lastVerifiedWorkflow

// Outline examples invoke the same step three times. Cache only a successful
// check of this exact workflow, so a changed gate is always checked again.
export function assertGeneratedGateSuccessOnce(workflow) {
  const fingerprint = JSON.stringify(workflow)
  if (fingerprint === lastVerifiedWorkflow) return
  const snapshot = structuredClone(workflow)
  fc.assert(successGateProperty(workflow), {
    seed: 104729,
    numRuns: 32,
    endOnFailure: true,
    examples: [[{ test: 0, lint: 1 }], [{ test: 1, lint: 0 }], [{ test: 6, lint: 6 }]],
  })
  assert.deepEqual(workflow, snapshot, 'Generating contexts must not mutate the checked-in workflow')
  lastVerifiedWorkflow = fingerprint
}
