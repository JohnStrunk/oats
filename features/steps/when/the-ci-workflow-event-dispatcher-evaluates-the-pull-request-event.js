import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow, getWorkflowTriggers } from '../workflow_helper.js'
When('the CI workflow event dispatcher evaluates the pull request event', function () {
  const workflow = loadCiWorkflow(), triggers = getWorkflowTriggers(workflow)
  assert(Array.isArray(triggers) ? triggers.includes('pull_request') : triggers.pull_request != null, `CI workflow does not configure 'pull_request' trigger: ${JSON.stringify(triggers)}`)
  this.evaluated_event = 'pull_request'; this.workflow = workflow
})
