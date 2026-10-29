import { Then } from '@cucumber/cucumber'
import { assertOutcome } from '../session_data_helper.js'
Then('the session data outcome shall match {string}', async function (outcome) {
  // Notifications can initiate asynchronous supported-client reads.
  if (outcome === 'live settlement' || outcome === 'live descendant') {
    const deadline = Date.now() + 2000
    while (Date.now() < deadline) {
      const records = this.service.getSnapshot().records
      if (outcome === 'live settlement' ? records.some((r) => r.messageID === 'live' && r.cost === 7) : records.some((r) => r.messageID === 'live-child-m')) break
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  assertOutcome(this.service.getSnapshot(), outcome)
})
