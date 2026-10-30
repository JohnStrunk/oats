import { When } from '@cucumber/cucumber'
import { maxSafeHostPins, overlargeHostPins, selectedTuiHost, withPinnedCheckout } from '../host_pin_contract_support.js'

When('a TUI smoke test is requested with version components at and beyond the safe integer limit', { timeout: 300000 }, function () {
  this.host_component_limits = [
    ...maxSafeHostPins.map(pin => ({ pin, valid: true })),
    ...overlargeHostPins.map(pin => ({ pin, valid: false })),
  ].map(({ pin, valid }) => ({ pin, valid, ...withPinnedCheckout(pin, (checkout, temp) => selectedTuiHost(checkout, temp, pin)) }))
})
