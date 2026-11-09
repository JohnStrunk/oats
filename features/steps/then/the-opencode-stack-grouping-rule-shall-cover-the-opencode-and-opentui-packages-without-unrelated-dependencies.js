import { Then } from '@cucumber/cucumber'
import { checkStackGroupScope } from '../opencode_stack_helper.js'

// Deliberately checks only literal scoped patterns: this is not a Renovate
// simulator. Reject unsupported matchers rather than guessing at their
// effect.
Then('the OpenCode stack grouping rule shall cover the OpenCode and OpenTUI packages without unrelated dependencies', function () {
  checkStackGroupScope(this.renovate_config)
})
