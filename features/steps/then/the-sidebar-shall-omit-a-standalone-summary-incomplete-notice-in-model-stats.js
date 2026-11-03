import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelSummaryNoticeAbsent } from '../model_sidebar_helper.js'

Then('the sidebar shall omit a standalone "Summary incomplete" notice in Model stats', { timeout: 15000 }, async function () {
  await eventually(this, modelSummaryNoticeAbsent,
    'Model stats must not show a standalone "Summary incomplete" notice')
})
