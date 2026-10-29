import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the refresh shall finish within the test deadline and identify the incomplete {} read', function (operation) {
  assert.equal(this.finished, true, 'refresh did not finish before the watchdog')
  assert.equal(this.incomplete.complete, false)
  assert.ok(this.incomplete.errors.some((error) => error.operation === operation && error.sessionID === 'root'), `missing ${operation} failure for root`)
  assert.ok(!this.incomplete.errors.some((error) => error.message?.includes('fixture safety ceiling')), 'fixture safety ceiling is not the system limit')
})
