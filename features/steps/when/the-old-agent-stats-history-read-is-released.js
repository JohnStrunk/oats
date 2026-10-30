import { When } from '@cucumber/cucumber'
import { updateControl, waitForCompletedRead } from '../sidebar_scenario_helper.js'

When('the old Agent stats history read is released', { timeout: 15000 }, async function () {
  await updateControl(this, fixture => { fixture.blockRoot = false })
  await waitForCompletedRead(this, this.sidebarFixture.rootSession)
})
