import { When } from '@cucumber/cucumber'
import * as ci from '../workflow_helper.js'
When('the CI workflow executes the YAML and workflow linter', { timeout: 120000 }, function () {
  this.actionlint_result = ci.runCiWorkflowLinter('actionlint')
  this.yamllint_result = ci.runCiWorkflowLinter('yamllint')
})
