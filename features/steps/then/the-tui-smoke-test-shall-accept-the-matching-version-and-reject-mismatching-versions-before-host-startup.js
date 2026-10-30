import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the TUI smoke test shall accept the matching version and reject mismatching versions before host startup', function () {
  const { pin, matching, wrong, suffix } = this.tui_pin_results
  for (const result of [matching, wrong, suffix]) {
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.notEqual(result.status, 0, 'The intentionally nonfunctional host must not pass the smoke test')
  }
  assert.equal(matching.started, true, `Matching TUI host ${pin} was rejected before startup:\n${matching.output}`)
  for (const result of [wrong, suffix]) {
    assert.equal(result.started, false, `Mismatching TUI host started for pin ${pin}:\n${result.output}`)
    assert.match(result.output, /OpenCode/, 'Expected a host selection diagnostic')
  }
})
