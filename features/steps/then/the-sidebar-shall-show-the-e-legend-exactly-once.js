import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { legendCount } from '../sidebar_alignment_helper.js'

Then('the sidebar shall show the e legend exactly once', { timeout: 15000 }, async function () {
  await eventually(this, text => legendCount(text) === 1, 'the e legend must appear exactly once')
})
