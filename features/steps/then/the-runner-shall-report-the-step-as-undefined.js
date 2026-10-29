import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the runner shall report the step as undefined', function () {
  const { scenarios } = this.migrationResult
  assert.deepEqual(scenarios.map(s => s.name), ['Undefined scenario'])
  assert.equal(scenarios[0].steps[0].result.status, 'undefined')
})
