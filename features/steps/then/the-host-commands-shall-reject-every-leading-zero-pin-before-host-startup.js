import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the host commands shall reject every leading-zero pin before host startup', function () {
  const control = this.leading_zero_host_control
  assert.ifError(control.error)
  assert.equal(control.signal, null)
  assert.notEqual(control.status, 0, 'The deliberately nonfunctional valid-version host must not pass the test')
  assert.equal(control.started, true, `The valid-version control did not reach host startup:\n${control.output}`)
  assert.equal(this.leading_zero_host_results.length, 3)
  for (const result of this.leading_zero_host_results) {
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.notEqual(result.status, 0, `The malformed pin ${result.pin} must fail`)
    assert.equal(result.started, false, `Host reporting malformed pin ${result.pin} started:\n${result.output}`)
  }
})
