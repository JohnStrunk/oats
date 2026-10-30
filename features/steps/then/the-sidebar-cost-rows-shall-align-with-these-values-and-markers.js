import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { inspectAlignment } from '../sidebar_alignment_helper.js'

Then('the sidebar cost rows shall align with these values and markers:', { timeout: 15000 }, async function (table) {
  const expected = table.hashes()
  if (expected.some(row => !['blank', 'e'].includes(row.marker))) throw new Error('invalid expected marker')
  await eventually(this, text => inspectAlignment(text, expected), 'cost row labels, values, or marker columns did not match')
})
