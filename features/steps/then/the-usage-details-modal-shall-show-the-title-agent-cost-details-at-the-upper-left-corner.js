import { Then } from '@cucumber/cucumber'
import { assertModalTitleAtUpperLeft } from '../usage_details_helper.js'

Then('the usage details modal shall show the title "Agent cost details" at the upper-left corner', { timeout: 15000 }, async function () {
  await assertModalTitleAtUpperLeft(this)
})
