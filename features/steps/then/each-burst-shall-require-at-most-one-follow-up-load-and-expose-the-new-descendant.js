import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('each burst shall require at most one follow-up load and expose the new descendant', function () {
  assert.equal(this.burstResult.failed, false, `${this.burstResult.errorInstance ?? ''} observed ${JSON.stringify(this.burstObservations)}`)
})
