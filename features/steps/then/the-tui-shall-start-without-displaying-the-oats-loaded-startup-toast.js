import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the TUI shall start without displaying the "OATS loaded" startup toast', function () {
  const result = this.tui_result
  assert(result.hostReady, `OpenCode TUI did not start (${result.diagnostic})`)
  assert(!result.toastVisible, `Toast appeared without OATS configured (${result.diagnostic})`)
  assert(result.controlCompleted, `Control observation ended early (${result.diagnostic})`)
})
