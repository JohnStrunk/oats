import { Then } from '@cucumber/cucumber'
import { assertOutcome } from '../session_data_helper.js'
Then('the route probe shall observe an empty dataset', function () { assertOutcome(this.routeSnapshot, 'empty') })
