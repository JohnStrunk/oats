import { Then } from '@cucumber/cucumber'
import { assertPairHeadingsEmphasized } from '../usage_details_helper.js'

Then('the usage details pair headings shall have SGR styling distinct from normal data cells', { timeout: 15000 }, async function () {
  await assertPairHeadingsEmphasized(this)
})
