import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('CI workflow verification shall accept each generated exact host pin', function () {
  assert.equal(this.ci_pin_results.length, 3)
  for (const result of this.ci_pin_results) {
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.equal(result.status, 0, `CI verification rejected pin ${result.pin}:\n${result.output}`)
  }
})
