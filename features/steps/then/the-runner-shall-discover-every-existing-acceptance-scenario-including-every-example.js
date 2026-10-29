import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { assertOriginalScenarios } from '../../tests/migration-step-support.js'

Then('the runner shall discover every existing acceptance scenario including every example', function () {
  const { status, output, scenarios } = this.migrationResult
  assert.equal(status, 0, output)
  for (const component of ['plugin-ui', 'repo-infrastructure']) {
    assertOriginalScenarios(scenarios.filter(s => s.uri.includes(`features/${component}/`)), component)
  }
})
