import { When } from '@cucumber/cucumber'
import * as ci from '../workflow_helper.js'
When('the CI workflow executes the shell script linter', { timeout: 120000 }, function () {
  this.shell_lint_result = ci.runCiWorkflowLinter('shellcheck')
})
