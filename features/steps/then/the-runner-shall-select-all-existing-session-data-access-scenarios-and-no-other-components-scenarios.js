import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then("the runner shall select all existing session data access scenarios and no other component's scenarios", function () {
  const { status, output, scenarios } = this.migrationResult
  assert.equal(status, 0, output)
  assert.ok(scenarios.length > 0, 'Session data access scenarios must be selected')
  assert.ok(scenarios.every((s) => s.uri.startsWith('features/session-data-access/')), 'A non-session-data-access scenario was selected')
})
