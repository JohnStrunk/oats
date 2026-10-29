import { When } from '@cucumber/cucumber'
import * as ci from '../workflow_helper.js'
When('the CI workflow executes the markdown linter', { timeout: 120000 }, function () {
  this.markdown_lint_result = ci.runCiWorkflowLinter('markdownlint')
})
