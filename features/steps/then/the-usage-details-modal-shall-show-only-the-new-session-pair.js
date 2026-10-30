import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually } from '../usage_details_helper.js'

Then('the usage details modal shall show only the new session pair', { timeout: 15000 }, async function () {
  const text = await eventually(this, frame => /new-agent/.test(frame) && /\$5\.00/.test(frame), 'the open modal must follow the new session')
  assert.doesNotMatch(text, /alpha\s+-\s+.*fixture-model/)
})
