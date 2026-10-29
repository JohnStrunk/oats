import assert from 'node:assert/strict'
import { When } from '@cucumber/cucumber'
import { runMigrationChild } from '../../tests/migration-step-support.js'
import { MIGRATION_STEP_TIMEOUT_MS } from '../../tests/migration-time-budget.js'

When('the contributor runs the isolated feature suite for the plugin UI component', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function () {
  assert.ok(this.migrationFixture, 'An isolated fixture must be prepared before running it')
  this.migrationResult = await runMigrationChild({ fixture: this.migrationFixture, component: 'plugin-ui' })
})
