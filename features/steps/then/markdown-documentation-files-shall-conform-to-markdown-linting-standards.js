import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('markdown documentation files shall conform to markdown linting standards', function () {
  assert.equal(this.markdown_lint_result.status, 0, `${this.markdown_lint_result.stdout}\n${this.markdown_lint_result.stderr}`)
})
