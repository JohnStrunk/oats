import { When } from '@cucumber/cucumber'
import { recordSettlement, updateControl } from '../sidebar_scenario_helper.js'

When('reported usage of {float} settles for agent {string}', async function (cost, agent) {
  await updateControl(this, fixture => recordSettlement(fixture, agent, cost))
})
