import { When } from '@cucumber/cucumber'
import { selectedTuiHost, withPinnedCheckout } from '../host_pin_contract_support.js'

When('a TUI smoke test is requested against an updated OpenCode host pin and selected host versions', { timeout: 150000 }, function () {
  const pin = '2.18.42'
  this.tui_pin_results = withPinnedCheckout(pin, (checkout, temp) => ({
    pin,
    matching: selectedTuiHost(checkout, temp, pin),
    wrong: selectedTuiHost(checkout, temp, '2.18.43'),
    suffix: selectedTuiHost(checkout, temp, `${pin}-rc1`),
  }))
})
