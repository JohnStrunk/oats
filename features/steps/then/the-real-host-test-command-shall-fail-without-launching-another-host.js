import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the real-host test command shall fail without launching another host', function () {
  assert.ifError(this.real_host_result.error)
  assert.notEqual(this.real_host_result.status, 0)
  assert.equal(this.real_host_result.signal, null)
  assert.match(this.real_host_result.stderr + this.real_host_result.stdout, /OATS_OPENCODE/)
  assert.equal(this.real_host_fallback_used, '')
})
