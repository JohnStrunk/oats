import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details modal shall preserve unattributed identities', { timeout: 15000 }, async function () {
  const text = await modal(this)
  const lines = text.split('\n')
  assert.ok(lines.some(line => /unattributed\s+-\s+.*fixture-model/i.test(line) && /\$1\.00/.test(line)), 'missing agent must retain its model and cost')
  assert.ok(lines.some(line => /alpha\s+-\s+.*unattributed/i.test(line) && /\$2\.00/.test(line)), 'missing model must retain its agent and cost')
})
