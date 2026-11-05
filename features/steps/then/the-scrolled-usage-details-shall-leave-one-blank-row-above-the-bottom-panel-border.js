import { Then } from '@cucumber/cucumber'
import { assertModalBottomPadding } from '../usage_details_helper.js'

Then('the scrolled usage details shall leave one blank row above the bottom panel border', { timeout: 15000 }, async function () {
  await assertModalBottomPadding(this)
})
