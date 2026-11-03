import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelStatsRowsMatch } from '../model_sidebar_helper.js'

Then('the sidebar model rows shall be:', { timeout: 15000 }, async function (table) {
  const expected = new Map(table.hashes().map(({ model, cost }) => [
    model,
    /^\$|^[<>]/.test(cost) || /^unavailable$/i.test(cost) ? cost : Number(cost),
  ]))
  await eventually(this, text => modelStatsRowsMatch(text, expected),
    `Model stats rows must match ${JSON.stringify([...expected])}`)
})
