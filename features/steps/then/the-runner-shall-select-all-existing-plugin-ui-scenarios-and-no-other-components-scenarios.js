import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { assertOriginalScenarios } from '../../tests/migration-step-support.js'

Then("the runner shall select all existing plugin UI scenarios and no other component's scenarios", function () {
  const { status, output, scenarios } = this.migrationResult
  assert.equal(status, 0, output)
  assertOriginalScenarios(scenarios, 'plugin-ui')
  assert.ok(scenarios.every(s => s.uri.includes('features/plugin-ui/')), 'A non-plugin UI scenario was selected')
})
