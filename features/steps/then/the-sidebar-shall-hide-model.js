import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelStatsCollapsed, modelStatsSectionHasRow } from '../model_sidebar_helper.js'

Then('the sidebar shall hide model {string}', { timeout: 15000 }, async function (name) {
  await eventually(this, text => modelStatsCollapsed(text) && !modelStatsSectionHasRow(text, name),
    `Model stats must hide model row ${name} while collapsed`)
})
