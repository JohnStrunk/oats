import { Then } from '@cucumber/cucumber'
import { eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall display bounded cost {string} for agent {string}', { timeout: 15000 }, async function (expected, name) {
  await eventually(this, text => {
    const row = rowFor(text, name)
    const value = row?.match(/:\s*([<>]?-?\$-?\d+\.\d{2})(?=\s|[│┃]|$)/)?.[1]
    return value === expected
  }, `${name} must show the exact amount or directional bound ${expected}`)
})
