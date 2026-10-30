import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { markedNumbers, modal, rowNumbers } from '../usage_details_helper.js'

Then('the usage details modal shall show known partial tokens as incomplete', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assert.deepEqual(rowNumbers(text, 'Tokens'), [400000, 500000, 250000, 500000])
  assert.equal(markedNumbers(text, 'Tokens'), 4, 'each partial token count must carry e')
})
