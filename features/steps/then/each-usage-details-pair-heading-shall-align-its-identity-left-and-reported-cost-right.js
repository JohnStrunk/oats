import { Then } from '@cucumber/cucumber'
import { assertPairHeadingAlignment } from '../usage_details_helper.js'

Then('each usage details pair heading shall align its identity left and reported cost right', { timeout: 15000 }, async function () {
  await assertPairHeadingAlignment(this)
})
