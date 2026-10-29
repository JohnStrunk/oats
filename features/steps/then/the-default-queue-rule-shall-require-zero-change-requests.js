import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall require zero change requests', function () {
  const conditions = getDefaultQueueRule(this.mergify_config ?? {}).queue_conditions ?? []
  assert(conditions.some(cond => typeof cond === 'string' && cond.includes('#changes-requested-reviews-by=0')), `Expected '#changes-requested-reviews-by=0' in queue_conditions: ${JSON.stringify(conditions)}`)
})
