import { Then } from '@cucumber/cucumber'
import { agentIncomplete, amountFor, eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify agent {string} as incomplete without a zero total', { timeout: 15000 }, async function (name) {
  await eventually(this, text => {
    const row = rowFor(text, name)
    return Boolean(row && agentIncomplete(text, name) && amountFor(row) !== 0)
  }, `${name} must be unknown or incomplete, not a zero total`)
})
