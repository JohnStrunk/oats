import { When } from '@cucumber/cucumber'
import { updateControl } from '../sidebar_scenario_helper.js'

When('the new Agent stats history read is released', async function () {
  await updateControl(this, fixture => { fixture.blockSessions = [] })
})
