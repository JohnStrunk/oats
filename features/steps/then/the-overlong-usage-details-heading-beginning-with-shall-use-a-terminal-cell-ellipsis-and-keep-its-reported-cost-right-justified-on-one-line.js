import { Then } from '@cucumber/cucumber'
import { assertOverlongPairHeading, eventually, modal, panelHasPairHeadingPrefix } from '../usage_details_helper.js'
import { detailsFixture } from '../usage_details_fixture.js'

Then('the overlong usage details heading beginning with {string} shall use a terminal-cell ellipsis and keep its reported cost {string} right-justified on one line', { timeout: 15000 }, async function (identityPrefix, reportedCost) {
  await modal(this)
  const text = await eventually(this, value => panelHasPairHeadingPrefix(value, identityPrefix) && value.includes(reportedCost),
    `the overlong heading beginning with ${JSON.stringify(identityPrefix)} and cost ${reportedCost} must be visible`)
  const fixture = detailsFixture(this.detailsFixtureName)
  const record = fixture.messages[fixture.rootSession][0]
  const fullIdentity = `${record.agent} - ${record.model.providerID}/${record.model.id}`
  assertOverlongPairHeading(text, { identityPrefix, fullIdentity, reportedCost })
})
