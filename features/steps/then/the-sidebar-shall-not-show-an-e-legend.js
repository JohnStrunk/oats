import { Then } from '@cucumber/cucumber'
import { eventually, historyState, sidebarAgentRows } from '../sidebar_scenario_helper.js'
import { legendCount } from '../sidebar_alignment_helper.js'

Then('the sidebar shall not show an e legend', { timeout: 15000 }, async function () {
  await eventually(this, text => {
    const rows = sidebarAgentRows(text)
    const hasRowsOrHistoryState = rows.length > 0 || ['loading', 'empty', 'unavailable'].some(state => historyState(text, state))
    return hasRowsOrHistoryState && rows.every(row => !/\$-?\d+\.\d{2}e(?:\s|[│┃]|$)/.test(row.tail)) && legendCount(text) === 0
  },
    'Agent stats without an e-marked row must not show an e legend')
})
