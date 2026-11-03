import { When } from '@cucumber/cucumber'
import { maxSafeHostPins, runCommand, withPinnedCheckoutBatch } from '../host_pin_contract_support.js'

When('CI workflow verification is run against maximum safe OpenCode host components', { timeout: 120000 }, function () {
  this.ci_pin_results = withPinnedCheckoutBatch(run => maxSafeHostPins.map(pin => ({
    pin,
    ...run(pin, checkout => runCommand(checkout, './node_modules/.bin/cucumber-js', [
      'features/repo-infrastructure/when-ci-runs-automated-tests-the-ci-workflow-shall-run-the-session-data-contract-test-against-the-pinned-opencode-host.feature',
    ])),
  })))
})
