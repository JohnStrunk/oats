import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('CI workflow verification shall reject each non-exact host declaration', function () {
  assert.equal(this.ci_invalid_pin_results.length, 10)
  for (const result of this.ci_invalid_pin_results) {
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.notEqual(result.status, 0, `CI verification accepted non-exact host declaration ${result.pin}`)
    const expected = `The CI host declaration must be an exact @opencode/cli release, got ${JSON.stringify(result.pin)}`
    assert.ok(result.output.includes(expected), `CI verification failed for an unrelated reason for ${result.pin}:\n${result.output}`)
  }
})
