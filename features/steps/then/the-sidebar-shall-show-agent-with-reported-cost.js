import { Then } from '@cucumber/cucumber'
import { amountFor, eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall show agent {string} with reported cost {float}', { timeout: 15000 }, async function (name, cost) {
  await eventually(this, text => amountFor(rowFor(text, name)) === cost,
    `agent ${name} must have reported cost $${cost}`)
})
