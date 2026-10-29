import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the test command shall return a zero exit status', function () {
  assert.equal(this.migrationResult.status, 0, this.migrationResult.output)
})
