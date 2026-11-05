import { Then } from '@cucumber/cucumber'
import { assertModalPadding } from '../usage_details_helper.js'

Then('the usage details modal shall render its title and pair heading with the requested padding', { timeout: 15000 }, async function () {
  await assertModalPadding(this)
})
