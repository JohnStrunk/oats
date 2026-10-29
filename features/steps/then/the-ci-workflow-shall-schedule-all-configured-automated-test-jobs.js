import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { requiredCiJobIds } from '../workflow_helper.js'
Then('the CI workflow shall schedule all configured automated test jobs', function () {
  assert.equal(this.schedule.triggered, true, 'The workflow was not triggered')
  for (const id of requiredCiJobIds(this.workflow)) {
    assert(this.schedule.scheduledJobIds.includes(id), `Required CI job ${id} was not scheduled`)
  }
})
