import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the runner shall execute only the repository infrastructure sandbox scenario', function () {
  const { status, output, scenarios, probes } = this.migrationResult
  assert.equal(status, 0, output)
  assert.deepEqual(probes, ['repo-infrastructure'])
  assert.deepEqual(scenarios.map(s => s.name), ['repo-infrastructure probe runs'])
  assert.ok(scenarios[0].steps.filter(step => !step.hidden).every(step => step.result.status === 'passed'))
})
