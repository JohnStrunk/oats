import { Then } from '@cucumber/cucumber'
import { eventually, summaryIncomplete } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify the overall summary as incomplete', { timeout: 15000 }, async function () {
  await eventually(this, summaryIncomplete,
    'the overall summary must indicate incomplete data')
})
