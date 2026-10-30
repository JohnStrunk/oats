import { Then } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

Then('the usage details modal shall be visible', { timeout: 15000 }, async function () {
  await modal(this)
})
