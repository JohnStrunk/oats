import { When } from '@cucumber/cucumber'
import { updateControl } from '../sidebar_scenario_helper.js'
import { resetSidebarReadAck, waitForSidebarReadAck } from '../sidebar_read_ack_helper.js'

When('the user switches the Agent stats session to {string}', { timeout: 15000 }, async function (sessionID) {
  const target = `ses_oats_${sessionID.replaceAll('-', '_')}`
  await resetSidebarReadAck(this.sidebarControl)
  await updateControl(this, fixture => { fixture.route = target })
  await waitForSidebarReadAck(this.sidebarControl, target)
})
