import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { inspectModelAlignment } from '../sidebar_model_alignment_helper.js'

Then('the Model stats cost rows shall align with these values and markers:', { timeout: 15000 }, async function (table) {
  const expected = table.hashes()
  if (expected.some(row => !['blank', 'e'].includes(row.marker))) throw new Error('invalid expected marker')
  await eventually(this, text => inspectModelAlignment(text, expected),
    'Model stats row labels, values, markers or columns did not match')
})
