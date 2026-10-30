import { When } from '@cucumber/cucumber'
import { maxSafeHostPins, runCommand, withPinnedCheckout } from '../host_pin_contract_support.js'

When('CI workflow verification is run against maximum safe OpenCode host components', { timeout: 120000 }, function () {
  this.ci_pin_results = maxSafeHostPins.map(pin => ({
    pin,
    ...withPinnedCheckout(pin, checkout => runCommand(checkout, './node_modules/.bin/cucumber-js', [
      'features/repo-infrastructure/when-ci-runs-automated-tests-the-ci-workflow-shall-run-the-session-data-contract-test-against-the-pinned-opencode-host.feature',
    ])),
  }))
})
