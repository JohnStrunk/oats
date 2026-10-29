import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the oversized sandbox write shall fail at the per-file ceiling', function () {
  const { observation, result, error, diskSize } = this.diskLimitResult
  assert.ok(observation, 'the sandbox did not report the result of its attempted write')
  assert.equal(observation.attempted, true)
  assert.equal(observation.completed, false, 'the oversized write unexpectedly completed')
  assert.ok(observation.code === 'EFBIG' || observation.signal === 'SIGXFSZ', 'the operating system must reject the write while it happens')
  assert.ok(diskSize >= 8 * 1024 * 1024, `premature limit: ${diskSize}`)
  assert.ok(diskSize <= 8 * 1024 * 1024 + 512, `file grew beyond the ceiling: ${diskSize}`)
  if (observation.bytes !== undefined) assert.equal(observation.bytes, diskSize)
  assert.ifError(error)
  assert.equal(result.timedOut, false, 'the runner must not time out')
  assert.notEqual(result.status, 0, 'the failed write must not be reported as a successful test run')
})
