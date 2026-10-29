import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the feature runner shall not execute its sandbox scenario', function () {
  const { control, restricted } = this.unavailableLimitResult
  assert.match(control, /OATS_NPM_LAUNCHED/, 'the control must exercise the npm CLI')
  assert.match(control, /OATS_FILE_LIMIT_CANARY/, `the unrestricted negative control must execute the sandbox: ${control}`)
  assert.doesNotMatch(restricted, /OATS_NPM_LAUNCHED/, 'npm must not start when the limit cannot be established')
  assert.doesNotMatch(restricted, /OATS_FILE_LIMIT_CANARY/, 'the runner executed despite an unavailable required ceiling')
  assert.match(restricted, /FAILED:/, 'the contract must report failure rather than silently succeeding')
})
