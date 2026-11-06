import { Then } from '@cucumber/cucumber'
import { assertModalElementsPairwiseColorDistinct } from '../usage_details_helper.js'

Then('the usage details modal title, pair titles, and table headings shall have pairwise-distinct SGR foreground or background colors', { timeout: 15000 }, async function () {
  await assertModalElementsPairwiseColorDistinct(this)
})
