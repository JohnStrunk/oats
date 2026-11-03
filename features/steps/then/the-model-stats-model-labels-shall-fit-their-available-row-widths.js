import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelSidebarRows } from '../model_sidebar_helper.js'
import { inspectModelNameSizing } from '../sidebar_model_alignment_helper.js'

Then('the Model stats model labels shall fit their available row widths:', { timeout: 15000 }, async function (table) {
  const expected = table.hashes()
  await eventually(this, text => {
    if (!inspectModelNameSizing(text, expected)) return false
    const rows = modelSidebarRows(text)
    return expected.every(item => !item.displayed_label ||
      rows.filter(row => row.value === item.cost && row.name === item.displayed_label).length === 1)
  }, 'Model stats labels must fit their measured row widths, match explicit examples and use deterministic collision suffixes')
})
