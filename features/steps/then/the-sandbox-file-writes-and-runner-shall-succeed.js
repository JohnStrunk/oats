import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the sandbox file writes and runner shall succeed', function () {
  const { observation, result, error, expectedSizes, permittedDiskSizes } = this.diskLimitResult
  assert.ifError(error)
  assert.equal(result.timedOut, false)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(observation.completed, true)
  assert.deepEqual(observation.expected, expectedSizes)
  assert.deepEqual(observation.actual, expectedSizes)
  assert.deepEqual(permittedDiskSizes, expectedSizes)
  assert.equal(observation.actual.at(-1), 8 * 1024 * 1024)
})
