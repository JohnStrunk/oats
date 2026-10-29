import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the settled record shall survive the stale response', function () {
  const records = this.routeSnapshot.records.filter((r) => r.messageID === 'race')
  assert.equal(records.length, 1)
  assert.equal(records[0].cost, 6)
})
