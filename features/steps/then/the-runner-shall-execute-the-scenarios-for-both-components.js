import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the runner shall execute the scenarios for both components', function () {
  const { status, output, scenarios, probes } = this.migrationResult
  assert.equal(status, 0, output)
  assert.deepEqual(probes.sort(), ['plugin-ui', 'repo-infrastructure'])
  assert.equal(scenarios.length, 2)
  assert.ok(scenarios.every(s => s.steps.filter(step => !step.hidden).every(step => step.result.status === 'passed')))
})
