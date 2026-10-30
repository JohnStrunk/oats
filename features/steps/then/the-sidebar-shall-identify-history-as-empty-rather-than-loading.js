import { Then } from '@cucumber/cucumber'
import { eventually, historyState } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify history as empty rather than loading', { timeout: 15000 }, async function () {
  await eventually(this, text => historyState(text, 'empty'),
    'empty history must be distinguished from loading')
})
