import { When } from '@cucumber/cucumber'
import { runMigrationChild } from '../../tests/migration-step-support.js'
import { MIGRATION_STEP_TIMEOUT_MS } from '../../tests/migration-time-budget.js'

When('the contributor runs the sandbox feature suite with the default configuration', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function () {
  this.migrationResult = await runMigrationChild({ fixture: this.migrationFixture })
})
