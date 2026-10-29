import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('all shell scripts shall conform to shellcheck standards', function () {
  assert.equal(this.shell_lint_result.status, 0, `${this.shell_lint_result.stdout}\n${this.shell_lint_result.stderr}`)
})
