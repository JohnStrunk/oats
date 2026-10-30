import { When } from '@cucumber/cucumber'
import { overlargeHostPins, runCommand, withPinnedCheckout } from '../host_pin_contract_support.js'

When('CI workflow verification is run against non-exact OpenCode host declarations', { timeout: 360000 }, function () {
  this.ci_invalid_pin_results = ['^2.0.32', '2.0', 'latest', undefined, '02.0.32', '2.00.32', '2.0.032', ...overlargeHostPins].map(pin => ({
    pin,
    ...withPinnedCheckout(pin, checkout => runCommand(checkout, './node_modules/.bin/cucumber-js', [
      'features/repo-infrastructure/when-ci-runs-automated-tests-the-ci-workflow-shall-run-the-session-data-contract-test-against-the-pinned-opencode-host.feature',
    ])),
  }))
})
