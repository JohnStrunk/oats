import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the workflow package rule shall specify rebaseWhen as {string}', function (mode) {
  const rule = this.workflow_package_rule ?? {}
  assert.equal(rule.rebaseWhen, mode, `Expected rebaseWhen '${mode}', got '${rule.rebaseWhen}' in rule: ${JSON.stringify(rule)}`)
})
