import { Then } from '@cucumber/cucumber'
import { assertOutcome } from '../session_data_helper.js'

Then('the released route snapshot shall contain the new session records', function () {
  assertOutcome(this.blockedRouteSnapshots.final, 'switched')
})
