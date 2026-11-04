import { When } from '@cucumber/cucumber'
import { pressEscape } from '../usage_details_helper.js'

When('the user presses Escape while the usage details modal is open', { timeout: 15000 }, async function () {
  await pressEscape(this)
})
