import { When } from '@cucumber/cucumber'
import { eventually, toggle } from '../sidebar_scenario_helper.js'

When('the user toggles Model stats using {word}', { timeout: 15000 }, async function (method) {
  await eventually(this, text => text.includes('Model stats'), 'the Model stats heading is missing')
  await toggle(this, method, 'Model stats')
})
