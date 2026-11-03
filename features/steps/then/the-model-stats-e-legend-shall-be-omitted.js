import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelSidebarRows, modelStatsHeadingIndicator, modelStatsLegendCount } from '../model_sidebar_helper.js'

Then('the Model stats e legend shall be omitted', { timeout: 15000 }, async function () {
  await eventually(this, text => modelStatsHeadingIndicator(text) !== undefined &&
    !modelSidebarRows(text).some(row => row.marker === 'e') && modelStatsLegendCount(text) === 0,
  'Model stats must omit its legend when no Model stats row has a lowercase e marker')
})
