import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelStatsHistoryState } from '../model_sidebar_helper.js'

Then('the sidebar shall identify Model stats history as {string} rather than empty', { timeout: 15000 }, async function (state) {
  await eventually(this, text => modelStatsHistoryState(text, state),
    `Model stats must identify history as ${state} rather than empty`)
})
