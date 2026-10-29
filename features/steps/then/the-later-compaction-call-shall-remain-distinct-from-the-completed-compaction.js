import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { CALL_ONE_ID, CALL_TWO_ID, callOneTokens, callTwoTokens } from '../auto_compaction_helper.js'
import { tokens } from '../followup_major_host.js'

Then('the later compaction call shall remain distinct from the completed compaction', function () {
  const records = this.laterCompactionSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 3, 'the two earlier calls and later distinct call must each be countable once, without the aggregate')
  const expected = [
    [CALL_ONE_ID, 0.5, callOneTokens],
    [CALL_TWO_ID, 1.5, callTwoTokens],
    ['evt_later_unframed_call_025', 7, tokens(7)],
  ]
  for (const [eventID, cost, usage] of expected) {
    const matches = records.filter((r) => r.eventID === eventID)
    assert.equal(matches.length, 1, `${eventID} must occur once`)
    assert.equal(matches[0].cost, cost)
    assert.deepEqual(matches[0].tokens, usage)
  }
  assert.equal(new Set(records.map((r) => r.id)).size, 3)
})
