import { Then } from '@cucumber/cucumber'
import { assertModalTitleColorDistinct } from '../usage_details_helper.js'

Then('the usage details title shall have an SGR foreground or background color distinct from ordinary numeric data', { timeout: 15000 }, async function () {
  await assertModalTitleColorDistinct(this)
})
