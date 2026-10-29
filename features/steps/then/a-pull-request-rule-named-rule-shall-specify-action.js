import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('a pull request rule named {string} shall specify the {string} action', function (name, action) {
  const rules = this.mergify_config?.pull_request_rules ?? []
  const rule = rules.find(rule => rule && typeof rule === 'object' && rule.name === name)
  assert(rule, `No pull_request_rules found named '${name}' in: ${JSON.stringify(rules)}`)
  assert(Object.hasOwn(rule.actions ?? {}, action), `Expected action '${action}' in rule actions: ${JSON.stringify(rule.actions)}`)
})
