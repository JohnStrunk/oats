import { When } from '@cucumber/cucumber'
import { clickEscButton } from '../usage_details_helper.js'

When('the user clicks the "esc" button', { timeout: 15000 }, async function () {
  await clickEscButton(this)
})
