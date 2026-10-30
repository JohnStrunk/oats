import { Then } from '@cucumber/cucumber'
import { eventually, sidebarAgentRows } from '../sidebar_scenario_helper.js'
import { legendCount } from '../sidebar_alignment_helper.js'

Then('the sidebar shall not show an e legend', { timeout: 15000 }, async function () {
  await eventually(this, text => {
    const rows = sidebarAgentRows(text)
    return rows.length >= 2 && rows.every(row => !/\$-?\d+\.\d{2}e(?:\s|[│┃]|$)/.test(row.tail)) && legendCount(text) === 0
  },
    'populated Agent stats without e markers must not show an e legend')
})
