import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall specify merge_method as {string}', function (method) {
  const rule = getDefaultQueueRule(this.mergify_config ?? {})
  assert.equal(rule.merge_method, method, `Expected merge_method '${method}', got '${rule.merge_method}' in queue rule: ${JSON.stringify(rule)}`)
})
