import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall specify a batch_size of {int}', function (size) {
  const rule = getDefaultQueueRule(this.mergify_config ?? {})
  assert.equal(rule.batch_size, size, `Expected batch_size ${size}, got ${rule.batch_size} in queue rule: ${JSON.stringify(rule)}`)
})
