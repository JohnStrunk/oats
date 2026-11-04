import { When } from '@cucumber/cucumber'
import { clickImmediatelyAboveModalPanel } from '../usage_details_helper.js'

When('the user clicks the cell immediately above the bordered panel', { timeout: 15000 }, async function () {
  await clickImmediatelyAboveModalPanel(this)
})
