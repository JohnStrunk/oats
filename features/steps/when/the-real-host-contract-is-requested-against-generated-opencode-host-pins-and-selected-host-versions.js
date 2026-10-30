import { When } from '@cucumber/cucumber'
import fc from 'fast-check'
import { selectedHost, withPinnedCheckout } from '../host_pin_contract_support.js'

When('the real-host contract is requested against generated OpenCode host pins and selected host versions', { timeout: 420000 }, function () {
  const pins = fc.sample(fc.tuple(fc.constant(2), fc.nat({ max: 99 }), fc.nat({ max: 99 })), { numRuns: 3, seed: 26 })
  this.real_host_pin_results = pins.map(([major, minor, patch]) => {
    const pin = `${major}.${minor}.${patch}`
    return withPinnedCheckout(pin, (checkout, temp) => ({
      pin,
      matching: selectedHost(checkout, temp, pin),
      wrong: selectedHost(checkout, temp, `${major}.${minor}.${patch + 1}`),
      suffix: selectedHost(checkout, temp, `${pin}-rc1`),
    }))
  })
})
