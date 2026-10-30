import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details table shall show Price Tokens and Cost rows in order', { timeout: 15000 }, async function () {
  const text = await modal(this)
  assert.match(text, /\bPrice\b[\s\S]*\bTokens\b[\s\S]*\bCost\b/i)
})
