import { Then } from '@cucumber/cucumber'
import { collapsedWithoutContent, eventually } from '../sidebar_scenario_helper.js'

Then('the sidebar shall hide agent {string}', { timeout: 15000 }, async function (name) {
  await eventually(this, collapsedWithoutContent,
    `agent ${name} must be hidden while the section is collapsed`)
})
