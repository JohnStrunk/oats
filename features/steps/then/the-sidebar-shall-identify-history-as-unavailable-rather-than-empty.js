import { Then } from '@cucumber/cucumber'
import { eventually, historyState } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify history as unavailable rather than empty', { timeout: 15000 }, async function () {
  await eventually(this, text => historyState(text, 'unavailable'),
    'failed history must show unavailable, not empty')
})
