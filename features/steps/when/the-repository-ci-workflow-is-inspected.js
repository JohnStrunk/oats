import { When } from '@cucumber/cucumber'
import { loadCiWorkflow } from '../workflow_helper.js'

When('the repository CI workflow is inspected', function () {
  this.ci_workflow = loadCiWorkflow()
})
