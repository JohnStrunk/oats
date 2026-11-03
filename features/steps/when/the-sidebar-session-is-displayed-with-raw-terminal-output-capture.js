import { When } from '@cucumber/cucumber'
import { startScenario } from '../sidebar_scenario_helper.js'
import { observeSidebarOutput } from '../sidebar_name_safety_helper.js'

When('the sidebar session is displayed with raw terminal output capture', { timeout: 90000 }, async function () {
  const stopCapture = await observeSidebarOutput(this)
  try {
    await startScenario(this, this.sidebarFixtureName)
  } finally {
    stopCapture()
  }
})
