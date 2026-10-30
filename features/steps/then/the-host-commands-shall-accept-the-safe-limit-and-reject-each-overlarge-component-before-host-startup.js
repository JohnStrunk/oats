import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the host commands shall accept the safe limit and reject each overlarge component before host startup', function () {
  assert.equal(this.host_component_limits.length, 6)
  for (const result of this.host_component_limits) {
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.notEqual(result.status, 0, 'The intentionally nonfunctional host must not pass the test')
    assert.equal(result.started, result.valid, `Unexpected startup for host reporting ${result.pin}:\n${result.output}`)
    if (!result.valid) {
      assert.match(result.output, /configured @opencode\/cli pin.*must be an exact release/, `Expected an invalid pin diagnostic for ${result.pin}`)
    }
  }
})
