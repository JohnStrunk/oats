import { When } from '@cucumber/cucumber'
import { eventually, toggle } from '../sidebar_scenario_helper.js'

When('the user toggles Agent stats using {word}', { timeout: 15000 }, async function (method) {
  await eventually(this, text => text.includes('Agent stats'), 'the section heading is missing')
  await toggle(this, method)
})
