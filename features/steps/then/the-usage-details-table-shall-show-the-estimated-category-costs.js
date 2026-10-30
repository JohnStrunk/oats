import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { markedNumbers, modal, rowNumbers } from '../usage_details_helper.js'

Then('the usage details table shall show the estimated category costs', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assert.deepEqual(rowNumbers(text, 'Cost'), [4, 2, 3, 7])
  assert.equal(markedNumbers(text, 'Cost'), 4, 'every calculated cost must carry an e marker')
})
