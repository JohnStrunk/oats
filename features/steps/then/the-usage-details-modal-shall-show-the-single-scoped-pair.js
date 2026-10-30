import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { assertHeading, modal } from '../usage_details_helper.js'

Then('the usage details modal shall show the single scoped pair', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assertHeading(text, 'alpha', 'fixture-model', '$3.00')
  assert.equal((text.match(/alpha\s+-\s+/g) ?? []).length, 1)
  assert.doesNotMatch(text, /other-agent/)
})
