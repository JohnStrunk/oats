import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the runner shall report the scenario as failed', function () {
  const { scenarios } = this.migrationResult
  assert.deepEqual(scenarios.map(s => s.name), ['Failing scenario'])
  assert.equal(scenarios[0].steps[0].result.status, 'failed')
  assert.match(scenarios[0].steps[0].result.error_message, /AssertionError.*intentional assertion failure/s)
})
