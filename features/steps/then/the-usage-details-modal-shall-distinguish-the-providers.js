import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details modal shall distinguish the providers', { timeout: 15000 }, async function () {
  const text = await modal(this)
  const lines = text.split('\n').filter(line => /alpha\s+-\s+.*fixture-model/.test(line))
  assert.equal(lines.length, 2, 'each provider must have a distinct pair heading')
  assert.ok(lines.some(line => /provider-a/.test(line) && /\$1\.00/.test(line)))
  assert.ok(lines.some(line => /provider-b/.test(line) && /\$2\.00/.test(line)))
})
