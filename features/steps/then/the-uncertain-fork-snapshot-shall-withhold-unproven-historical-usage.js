import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the uncertain fork snapshot shall withhold unproven historical usage', function () {
  const snapshot = this.uncertainForkSnapshot
  assert.equal(snapshot.sessionID, 'fork')
  assert.deepEqual(snapshot.records.map((record) => [record.sessionID, record.messageID, record.cost]), [['child', 'child-own', 3]], 'neither copied messages nor historical event costs may be attributed to an unproven fork')
})
