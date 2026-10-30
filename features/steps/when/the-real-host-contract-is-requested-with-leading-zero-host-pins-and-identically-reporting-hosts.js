import { When } from '@cucumber/cucumber'
import { selectedHost, withPinnedCheckout } from '../host_pin_contract_support.js'

When('the real-host contract is requested with leading-zero host pins and identically reporting hosts', { timeout: 200000 }, function () {
  this.leading_zero_host_control = withPinnedCheckout('2.18.42', (checkout, temp) => selectedHost(checkout, temp, '2.18.42'))
  this.leading_zero_host_results = ['02.0.32', '2.00.32', '2.0.032'].map(pin => ({
    pin,
    ...withPinnedCheckout(pin, (checkout, temp) => selectedHost(checkout, temp, pin)),
  }))
})
