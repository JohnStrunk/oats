import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { lineWith, modal } from '../usage_details_helper.js'

Then('the usage details modal shall show unknown values and preserve partial reported cost', { timeout: 15000 }, async function () {
  const text = await modal(this)
  const heading = text.split('\n').find(line => line.includes('alpha') && line.includes('fixture-model')) ?? ''
  assert.match(heading, /\$2\.00/)
  assert.match(heading, /(?:\$2\.00\s*e|e\s*\$2\.00)/)
  for (const label of ['Price', 'Tokens', 'Cost']) {
    const line = lineWith(text, label)
    assert.ok((line.match(/unknown|unavailable|—|\?/gi) ?? []).length >= 4, `${label} must identify each unknown cell: ${line}`)
    assert.doesNotMatch(line, /\b0(?:\.0+)?\b/)
  }
})
