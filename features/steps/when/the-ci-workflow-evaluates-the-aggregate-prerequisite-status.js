import { When } from '@cucumber/cucumber'
import { loadCiWorkflow, executeSuccessfulCiGate, workflowWithSyntheticChecks } from '../workflow_helper.js'
When('the CI workflow evaluates the aggregate prerequisite status', { timeout: 10000 }, function () {
  let workflow = loadCiWorkflow()
  if (this.synthetic_job_counts) workflow = workflowWithSyntheticChecks(workflow, this.synthetic_job_counts)
  this.actual_conclusion = executeSuccessfulCiGate(workflow, this.job_results ?? {})
  this.gate_executed = true
})
