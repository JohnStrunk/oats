import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow, getWorkflowTriggers } from '../workflow_helper.js'
When('the CI workflow event dispatcher evaluates the dispatch event', function () {
  const workflow = loadCiWorkflow(), triggers = getWorkflowTriggers(workflow)
  assert(Array.isArray(triggers) ? triggers.includes('workflow_dispatch') : Object.hasOwn(triggers, 'workflow_dispatch'), `CI workflow does not configure 'workflow_dispatch' trigger: ${JSON.stringify(triggers)}`)
  this.evaluated_event = 'workflow_dispatch'; this.workflow = workflow
})
