import { Then } from '@cucumber/cucumber'
import { eventually, historyState } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify history as loading rather than empty', { timeout: 15000 }, async function () {
  await eventually(this, text => historyState(text, 'loading'),
    'blocked history must show loading, not empty')
})
