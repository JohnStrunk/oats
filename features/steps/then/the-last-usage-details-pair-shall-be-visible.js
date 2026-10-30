import { Then } from '@cucumber/cucumber'
import { eventually } from '../usage_details_helper.js'

Then('the last usage details pair shall be visible', { timeout: 15000 }, async function () {
  await eventually(this, text => /agent-24\s+-\s+.*fixture-model/.test(text), 'the final table must be reachable by scrolling')
})
