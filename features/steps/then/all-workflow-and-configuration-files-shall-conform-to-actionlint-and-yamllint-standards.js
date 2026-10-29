import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('all workflow and configuration files shall conform to actionlint and yamllint standards', function () {
  for (const result of [this.actionlint_result, this.yamllint_result]) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  }
})
