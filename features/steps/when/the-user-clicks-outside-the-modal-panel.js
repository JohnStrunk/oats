import { When } from '@cucumber/cucumber'
import { clickOutsideModalPanel } from '../usage_details_helper.js'

When('the user clicks outside the modal panel', { timeout: 15000 }, async function () {
  await clickOutsideModalPanel(this)
})
