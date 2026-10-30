import { Then } from '@cucumber/cucumber'
import { agentIncomplete, eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall display agent {string} as unavailable and incomplete', { timeout: 15000 }, async function (name) {
  await eventually(this, text => {
    const row = rowFor(text, name)
    return Boolean(row && /(?:\s|:)unavailable(?:\s|[│┃]|$)/i.test(row) && !row.includes('$') && agentIncomplete(text, name))
  }, `${name} must be unavailable and incomplete, without a numerical limit`)
})
