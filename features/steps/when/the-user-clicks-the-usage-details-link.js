import { When } from '@cucumber/cucumber'
import { clickDetails } from '../usage_details_helper.js'

When('the user clicks the usage details link', { timeout: 15000 }, async function () {
  await clickDetails(this)
})
