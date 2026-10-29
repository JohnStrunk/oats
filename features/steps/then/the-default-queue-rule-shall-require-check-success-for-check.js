import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall require check-success for {string}', function (name) {
  const conditions = getDefaultQueueRule(this.mergify_config ?? {}).queue_conditions ?? []
  assert(conditions.some(cond => typeof cond === 'string' && (cond.includes(`check-success=${name}`) || cond.includes(`check-success="${name}"`))), `Expected check-success for '${name}' in queue_conditions: ${JSON.stringify(conditions)}`)
})
