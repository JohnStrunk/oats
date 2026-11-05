import { Then } from '@cucumber/cucumber'
import { assertTableHeadingColorsDistinct } from '../usage_details_helper.js'

Then('the usage details column-heading row and row-label column shall have SGR background colors distinct from ordinary numeric data', { timeout: 15000 }, async function () {
  await assertTableHeadingColorsDistinct(this)
})
