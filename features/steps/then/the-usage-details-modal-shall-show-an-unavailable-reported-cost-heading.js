import { Then } from '@cucumber/cucumber'
import { assertUnavailableReportedCostHeading } from '../usage_details_helper.js'

Then('the usage details modal shall show an unavailable reported-cost heading', { timeout: 15000 }, async function () {
  await assertUnavailableReportedCostHeading(this)
})
