import { Then } from '@cucumber/cucumber'
import { assertModalClosed } from '../usage_details_helper.js'

Then('the usage details modal shall be closed', { timeout: 15000 }, async function () {
  await assertModalClosed(this)
})
