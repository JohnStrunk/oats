import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { assertOriginalScenarios } from '../../tests/migration-step-support.js'

Then("the runner shall select all existing repository infrastructure scenarios and no other component's scenarios", function () {
  const { status, output, scenarios } = this.migrationResult
  assert.equal(status, 0, output)
  assertOriginalScenarios(scenarios, 'repo-infrastructure')
  assert.ok(scenarios.every(s => s.uri.includes('features/repo-infrastructure/')), 'A non-infrastructure scenario was selected')
})
