import { When } from '@cucumber/cucumber'
import { selectedTuiHost, withPinnedCheckout } from '../host_pin_contract_support.js'

When('a TUI smoke test is requested with leading-zero host pins and identically reporting hosts', { timeout: 200000 }, function () {
  this.leading_zero_host_control = withPinnedCheckout('2.18.42', (checkout, temp) => selectedTuiHost(checkout, temp, '2.18.42'))
  this.leading_zero_host_results = ['02.0.32', '2.00.32', '2.0.032'].map(pin => ({
    pin,
    ...withPinnedCheckout(pin, (checkout, temp) => selectedTuiHost(checkout, temp, pin)),
  }))
})
