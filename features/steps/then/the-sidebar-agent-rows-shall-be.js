import { Then } from '@cucumber/cucumber'
import { eventually, sidebarRowsMatch } from '../sidebar_scenario_helper.js'

Then('the sidebar agent rows shall be:', { timeout: 15000 }, async function (table) {
  const expected = new Map(table.hashes().map(row => [row.agent, Number(row.cost)]))
  await eventually(this, text => sidebarRowsMatch(text, expected),
    `sidebar rows must match ${JSON.stringify([...expected])}`)
})
