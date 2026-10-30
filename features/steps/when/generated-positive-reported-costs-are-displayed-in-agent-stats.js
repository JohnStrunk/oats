import { When } from '@cucumber/cucumber'
import { startScenario } from '../sidebar_scenario_helper.js'

When('generated positive reported costs are displayed in Agent stats', { timeout: 90000 }, async function () {
  await startScenario(this, 'formatting')
})
