import { When } from '@cucumber/cucumber'
import fc from 'fast-check'
import { runCommand, withPinnedCheckout } from '../host_pin_contract_support.js'

When('CI workflow verification is run against generated exact OpenCode host pins', { timeout: 120000 }, function () {
  const pins = fc.sample(fc.tuple(fc.constant(2), fc.nat({ max: 99 }), fc.nat({ max: 99 })), { numRuns: 3, seed: 25 })
  this.ci_pin_results = pins.map(parts => {
    const pin = parts.join('.')
    return { pin, ...withPinnedCheckout(pin, checkout => runCommand(checkout, './node_modules/.bin/cucumber-js', [
      'features/repo-infrastructure/when-ci-runs-automated-tests-the-ci-workflow-shall-run-the-session-data-contract-test-against-the-pinned-opencode-host.feature',
    ])) }
  })
})
