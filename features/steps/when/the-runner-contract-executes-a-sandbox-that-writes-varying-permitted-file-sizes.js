import { When } from '@cucumber/cucumber'
import { runDiskLimitFixture } from '../disk-limit-support.js'
import { MIGRATION_STEP_TIMEOUT_MS } from '../../tests/migration-time-budget.js'

When('the runner contract executes a sandbox that writes varying permitted file sizes', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function () {
  this.diskLimitResult = await runDiskLimitFixture('small', 'direct')
})
