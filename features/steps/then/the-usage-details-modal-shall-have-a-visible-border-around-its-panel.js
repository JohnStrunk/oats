import { Then } from '@cucumber/cucumber'
import { assertVisibleModalBorder } from '../usage_details_helper.js'

Then('the usage details modal shall have a visible border around its panel', { timeout: 15000 }, async function () {
  await assertVisibleModalBorder(this)
})
