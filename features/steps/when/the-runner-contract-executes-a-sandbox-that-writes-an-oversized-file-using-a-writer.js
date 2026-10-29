import { When } from '@cucumber/cucumber'
import { runDiskLimitFixture } from '../disk-limit-support.js'
import { MIGRATION_STEP_TIMEOUT_MS } from '../../tests/migration-time-budget.js'

When('the runner contract executes a sandbox that writes an oversized {word} using a {word}', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function (file, writer) {
  this.diskLimitResult = await runDiskLimitFixture(file, writer)
})
