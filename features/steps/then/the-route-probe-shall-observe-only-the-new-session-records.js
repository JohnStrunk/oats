import { Then } from '@cucumber/cucumber'
import { assertOutcome } from '../session_data_helper.js'
Then('the route probe shall observe only the new session records', function () { assertOutcome(this.routeSnapshot, 'switched') })
