import { Then } from '@cucumber/cucumber'
import { assertTableHeadersEmphasized } from '../usage_details_helper.js'

Then('the usage details table headings and row labels shall have SGR styling distinct from numeric data', { timeout: 15000 }, async function () {
  await assertTableHeadersEmphasized(this)
})
