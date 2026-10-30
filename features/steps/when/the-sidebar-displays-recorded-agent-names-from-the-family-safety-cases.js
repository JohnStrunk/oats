import { When } from '@cucumber/cucumber'
import { startScenario } from '../sidebar_scenario_helper.js'
import { observeSidebarOutput, safetyFixture } from '../sidebar_name_safety_helper.js'

When('the sidebar displays recorded agent names from the {string} safety cases', { timeout: 90000 }, async function (family) {
  this.nameSafetyFamily = family
  const stopCapture = await observeSidebarOutput(this)
  try {
    await startScenario(this, 'name safety', safetyFixture())
  } finally {
    stopCapture()
  }
})
