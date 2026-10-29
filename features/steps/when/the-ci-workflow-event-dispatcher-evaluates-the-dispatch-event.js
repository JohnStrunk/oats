import { When } from '@cucumber/cucumber'
import * as ci from '../workflow_helper.js'
When('the CI workflow event dispatcher evaluates the dispatch event', function () {
  this.workflow = ci.loadCiWorkflow()
  this.schedule = ci.evaluateCiScheduling(this.workflow, { type: this.event_type })
})
