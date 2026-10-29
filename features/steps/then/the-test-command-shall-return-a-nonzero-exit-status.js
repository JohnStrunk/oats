import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the test command shall return a nonzero exit status', function () {
  assert.notEqual(this.migrationResult.status, 0, 'A failing or undefined step must fail the test command')
})
