import { Then } from '@cucumber/cucumber'
import { agentIncomplete, eventually } from '../sidebar_scenario_helper.js'

Then('the sidebar shall identify agent {string} as incomplete', { timeout: 15000 }, async function (name) {
  await eventually(this, text => agentIncomplete(text, name),
    `${name} must be visibly identified as incomplete`)
})
