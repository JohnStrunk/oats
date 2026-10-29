import { When } from '@cucumber/cucumber'
import { runUnavailableLimitFixture, UNAVAILABLE_LIMIT_STEP_TIMEOUT_MS } from '../disk-limit-support.js'

When('the runner contract is invoked with a zero-byte hard file-size limit', { timeout: UNAVAILABLE_LIMIT_STEP_TIMEOUT_MS }, async function () {
  this.unavailableLimitResult = await runUnavailableLimitFixture()
})
