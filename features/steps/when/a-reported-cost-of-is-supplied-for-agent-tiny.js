import { When } from '@cucumber/cucumber'
import { setTinyCost, updateControl } from '../sidebar_scenario_helper.js'

When('a reported cost of {string} is supplied for agent tiny', async function (value) {
  const cost = Number(value)
  if (!Number.isFinite(cost)) throw new Error(`invalid reported cost: ${value}`)
  await updateControl(this, fixture => setTinyCost(fixture, cost))
})
