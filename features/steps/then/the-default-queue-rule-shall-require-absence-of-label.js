import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall require absence of the {string} label', function (label) {
  const conditions = getDefaultQueueRule(this.mergify_config ?? {}).queue_conditions ?? [], expected = `label!=${label}`
  assert(conditions.some(cond => typeof cond === 'string' && cond.includes(expected)), `Expected '${expected}' in queue_conditions: ${JSON.stringify(conditions)}`)
})
