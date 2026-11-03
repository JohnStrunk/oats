import { When } from '@cucumber/cucumber'
import { maxSafeHostPins, overlargeHostPins, selectedTuiHost, withPinnedCheckoutBatch } from '../host_pin_contract_support.js'

When('a TUI smoke test is requested with version components at and beyond the safe integer limit', { timeout: 300000 }, function () {
  const cases = [
    ...maxSafeHostPins.map(pin => ({ pin, valid: true })),
    ...overlargeHostPins.map(pin => ({ pin, valid: false })),
  ]
  this.host_component_limits = withPinnedCheckoutBatch(run => cases.map(({ pin, valid }) => ({
    pin,
    valid,
    ...run(pin, (checkout, temp) => selectedTuiHost(checkout, temp, pin)),
  })))
})
