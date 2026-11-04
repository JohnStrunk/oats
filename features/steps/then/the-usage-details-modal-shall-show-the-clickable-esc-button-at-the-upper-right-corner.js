import { Then } from '@cucumber/cucumber'
import { assertEscButtonAtUpperRight } from '../usage_details_helper.js'

Then('the usage details modal shall show the clickable "esc" button at the upper-right corner', { timeout: 15000 }, async function () {
  await assertEscButtonAtUpperRight(this)
})
