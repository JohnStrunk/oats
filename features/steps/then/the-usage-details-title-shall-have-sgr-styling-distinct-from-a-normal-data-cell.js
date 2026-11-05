import { Then } from '@cucumber/cucumber'
import { assertModalTitleEmphasized } from '../usage_details_helper.js'

Then('the usage details title shall have SGR styling distinct from a normal data cell', { timeout: 15000 }, async function () {
  await assertModalTitleEmphasized(this)
})
