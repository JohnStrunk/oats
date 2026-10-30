import { When } from '@cucumber/cucumber'
import { startScenario, waitForBlockedRead } from '../sidebar_scenario_helper.js'
import { startDetails } from '../usage_details_helper.js'

When('the Agent stats session is displayed', { timeout: 90000 }, async function () {
  if (this.detailsFixtureName) await startDetails(this)
  else await startScenario(this, this.sidebarFixtureName)
  if (['blocked history', 'blocked old session'].includes(this.sidebarFixtureName)) {
    await waitForBlockedRead(this, this.sidebarFixture.rootSession)
  }
})
