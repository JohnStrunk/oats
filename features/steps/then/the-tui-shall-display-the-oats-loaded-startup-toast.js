import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the TUI shall display the "OATS loaded" startup toast', function () {
  const result = this.tui_result
  assert(result.hostReady, `OpenCode TUI did not start (${result.diagnostic})`)
  assert(result.toastVisible, `OATS startup toast was not rendered (${result.diagnostic})`)
})
