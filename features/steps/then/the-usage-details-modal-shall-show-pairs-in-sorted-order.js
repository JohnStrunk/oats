import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details modal shall show pairs in sorted order', { timeout: 15000 }, async function () {
  const text = await modal(this)
  const headings = text.split('\n').filter(line => /(?:alpha|beta)\s+-\s+.*(?:a-model|z-model)/.test(line))
  assert.equal(headings.length, 3, `Expected all three pair headings:\n${text}`)
  assert.match(headings[0], /alpha.*a-model/)
  assert.match(headings[1], /alpha.*z-model/)
  assert.match(headings[2], /beta.*z-model/)
})
