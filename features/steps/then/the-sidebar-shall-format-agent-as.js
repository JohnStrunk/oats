import { Then } from '@cucumber/cucumber'
import { displayedValue, eventually, rowFor } from '../sidebar_scenario_helper.js'

Then('the sidebar shall format agent {string} as {string}', { timeout: 15000 }, async function (name, amount) {
  await eventually(this, text => {
    const rendered = displayedValue(rowFor(text, name))
    return rendered === amount
  }, `${name} must show exactly ${amount}`)
})
