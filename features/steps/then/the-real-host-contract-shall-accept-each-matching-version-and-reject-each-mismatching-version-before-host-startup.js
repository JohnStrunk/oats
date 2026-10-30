import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the real-host contract shall accept each matching version and reject each mismatching version before host startup', function () {
  assert.equal(this.real_host_pin_results.length, 3)
  for (const { pin, matching, wrong, suffix } of this.real_host_pin_results) {
    for (const result of [matching, wrong, suffix]) {
      assert.ifError(result.error)
      assert.equal(result.signal, null)
      assert.notEqual(result.status, 0, 'The intentionally nonfunctional host must not pass the contract')
    }
    assert.equal(matching.started, true, `Matching pin ${pin} was rejected before host startup:\n${matching.output}`)
    for (const result of [wrong, suffix]) {
      assert.equal(result.started, false, `Mismatching host started for pin ${pin}:\n${result.output}`)
      assert.match(result.output, /OATS_OPENCODE/, 'Expected a host selection diagnostic')
    }
  }
})
