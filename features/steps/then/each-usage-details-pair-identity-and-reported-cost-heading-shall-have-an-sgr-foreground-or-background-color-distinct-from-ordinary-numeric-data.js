import { Then } from '@cucumber/cucumber'
import { assertPairHeadingsColorDistinct } from '../usage_details_helper.js'

Then('each usage details pair identity and reported-cost heading shall have an SGR foreground or background color distinct from ordinary numeric data', { timeout: 15000 }, async function () {
  await assertPairHeadingsColorDistinct(this)
})
