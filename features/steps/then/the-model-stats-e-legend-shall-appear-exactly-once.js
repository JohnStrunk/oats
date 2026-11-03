import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelSidebarRows, modelStatsLegendCount } from '../model_sidebar_helper.js'

Then('the Model stats e legend shall appear exactly once', { timeout: 15000 }, async function () {
  await eventually(this, text => modelSidebarRows(text).some(row => row.marker === 'e') && modelStatsLegendCount(text) === 1,
    'Model stats must have a row-level e marker and exactly one legend in its own section')
})
