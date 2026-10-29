import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getDefaultQueueRule } from '../mergify_helper.js'
Then('the default queue rule shall allow trusted authors or approved reviews', function () {
  const conditions = getDefaultQueueRule(this.mergify_config ?? {}).queue_conditions ?? []
  const found = conditions.some(cond => cond && typeof cond === 'object' && Array.isArray(cond.or) && cond.or.some(item => typeof item === 'string' && item.includes('author=')) && cond.or.some(item => typeof item === 'string' && item.includes('approved-reviews-by')))
  assert(found, `Expected 'or' block with author and approved-reviews conditions in queue_conditions: ${JSON.stringify(conditions)}`)
})
