import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow, getWorkflowTriggers } from '../workflow_helper.js'
When('the CI workflow event dispatcher evaluates the push event', function () {
  const workflow = loadCiWorkflow(), triggers = getWorkflowTriggers(workflow)
  assert(Array.isArray(triggers) ? triggers.includes('push') : triggers.push != null, `CI workflow does not configure 'push' trigger: ${JSON.stringify(triggers)}`)
  this.evaluated_event = 'push'; this.workflow = workflow
})
