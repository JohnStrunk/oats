import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelStatsRowsMatch } from '../model_sidebar_helper.js'

Then('the sidebar shall show model {string} with reported cost {float}', { timeout: 15000 }, async function (model, cost) {
  await eventually(this, text => modelStatsRowsMatch(text, new Map([[model, cost]])),
    `${model} must be a visible Model stats row with reported cost ${cost}`)
})
