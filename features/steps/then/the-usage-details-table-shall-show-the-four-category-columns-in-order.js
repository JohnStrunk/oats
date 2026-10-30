import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details table shall show the four category columns in order', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assert.match(text, /input\s+output\s+cache\s+write\s+cache\s+read/i)
})
