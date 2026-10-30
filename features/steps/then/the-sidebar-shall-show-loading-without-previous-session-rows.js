import { Then } from '@cucumber/cucumber'
import { eventually, historyState, sidebarAgentRows, waitForBlockedRead } from '../sidebar_scenario_helper.js'

Then('the sidebar shall show loading without previous session rows', { timeout: 15000 }, async function () {
  await waitForBlockedRead(this, 'ses_oats_new_root')
  await eventually(this, text => historyState(text, 'loading') && sidebarAgentRows(text).length === 0,
    'the new session must show loading without the old session rows')
})
