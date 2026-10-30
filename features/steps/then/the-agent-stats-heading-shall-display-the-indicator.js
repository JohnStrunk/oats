import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'

Then('the Agent stats heading shall display the {string} indicator', { timeout: 15000 }, async function (indicator) {
  await eventually(this, text => {
    const heading = text.split('\n').find(line => line.includes('Agent stats')) ?? ''
    return heading.includes(`${indicator} Agent stats`)
  }, `Agent stats heading must use ${indicator}`)
})
