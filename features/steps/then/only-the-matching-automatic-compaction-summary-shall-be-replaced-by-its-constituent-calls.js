import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { CALL_ONE_ID, CALL_TWO_ID, MESSAGE_ID, OTHER_MESSAGE_ID, callOneTokens, callTwoTokens, totalTokens } from '../auto_compaction_helper.js'

Then('only the matching automatic compaction summary shall be replaced by its constituent calls', function () {
  const records = this.regressionHost.service.getSnapshot().records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 3, 'two constituent calls and the unrelated summary must remain')
  assert.equal(records.filter((r) => r.messageID === MESSAGE_ID).length, 0, 'the fully accounted summary must not be an additional call')
  const first = records.find((r) => r.eventID === CALL_ONE_ID)
  const second = records.find((r) => r.eventID === CALL_TWO_ID)
  assert.ok(first && second, 'both ordered log calls must remain attributable')
  assert.equal(first.cost, 0.5); assert.deepEqual(first.tokens, callOneTokens)
  assert.equal(second.cost, 1.5); assert.deepEqual(second.tokens, callTwoTokens)
  const other = records.filter((r) => r.messageID === OTHER_MESSAGE_ID)
  assert.equal(other.length, 1, 'an equal-usage summary from another compaction must remain')
  assert.equal(other[0].cost, 2); assert.deepEqual(other[0].tokens, totalTokens)
})
