import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { CALL_ONE_ID, CALL_TWO_ID, MESSAGE_ID } from '../auto_compaction_helper.js'

Then('the known compaction calls shall remain without counting their aggregate again', function () {
  const before = this.initialCompactionSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  const after = this.failedCompactionSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  for (const eventID of [CALL_ONE_ID, CALL_TWO_ID]) {
    const expected = before.find((r) => r.eventID === eventID)
    const actual = after.filter((r) => r.eventID === eventID)
    assert.equal(actual.length, 1, `known call ${eventID} must remain once`)
    assert.deepEqual(actual[0], expected, `known call ${eventID} must retain its identity and usage`)
  }
  assert.equal(after.filter((r) => r.messageID === MESSAGE_ID).length, 0, 'the aggregate must not be counted in addition to its constituent calls')
  assert.equal(after.length, 2, 'no other compaction record may duplicate the known calls')
  assert.equal(after.reduce((sum, record) => sum + record.cost, 0), 2, 'the total reported cost must be counted once')
})
