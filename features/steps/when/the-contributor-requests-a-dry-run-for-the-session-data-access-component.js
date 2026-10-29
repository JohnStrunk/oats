import { When } from '@cucumber/cucumber'
import { runMigrationChild } from '../../tests/migration-step-support.js'
import { MIGRATION_STEP_TIMEOUT_MS } from '../../tests/migration-time-budget.js'

When('the contributor requests a dry run for the session data access component', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function () {
  this.migrationResult = await runMigrationChild({ dryRun: true, component: 'session-data-access' })
})
