import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal, rowNumbers } from '../usage_details_helper.js'

Then('the usage details table shall show the known token counts', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assert.deepEqual(rowNumbers(text, 'Tokens'), [800000, 1000000, 500000, 1000000])
})
