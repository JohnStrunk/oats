import { When } from '@cucumber/cucumber'
import { startScenario, stopScenario } from '../sidebar_scenario_helper.js'

When('the Agent stats app is restarted', { timeout: 90000 }, async function () {
  const fixture = structuredClone(this.sidebarFixture)
  await stopScenario(this)
  await startScenario(this, this.sidebarFixtureName, fixture)
})
