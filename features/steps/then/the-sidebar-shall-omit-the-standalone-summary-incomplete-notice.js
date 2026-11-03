import { Then } from '@cucumber/cucumber'
import { eventually, summaryNoticeAbsent } from '../sidebar_scenario_helper.js'

Then('the sidebar shall omit the standalone "Summary incomplete" notice', { timeout: 15000 }, async function () {
  await eventually(this, summaryNoticeAbsent,
    'Agent stats must not display a standalone "Summary incomplete" notice')
})
