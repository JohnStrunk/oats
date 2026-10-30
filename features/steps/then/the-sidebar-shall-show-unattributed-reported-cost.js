import { Then } from '@cucumber/cucumber'
import { amountFor, eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall show unattributed reported cost {float}', { timeout: 15000 }, async function (cost) {
  await eventually(this, text => amountFor(rowFor(text, 'unattributed')) === cost,
    `unattributed work must retain reported cost $${cost}`)
})
