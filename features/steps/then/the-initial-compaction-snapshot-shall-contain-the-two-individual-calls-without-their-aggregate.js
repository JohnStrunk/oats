import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { CALL_ONE_ID, CALL_TWO_ID, callOneTokens, callTwoTokens } from '../auto_compaction_helper.js'

Then('the initial compaction snapshot shall contain the two individual calls without their aggregate', function () {
  const records = this.initialCompactionSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 2)
  const first = records.find((r) => r.eventID === CALL_ONE_ID)
  const second = records.find((r) => r.eventID === CALL_TWO_ID)
  assert.ok(first && second, 'the successful refresh must establish both individual calls')
  assert.equal(first.cost, 0.5)
  assert.deepEqual(first.tokens, callOneTokens)
  assert.equal(second.cost, 1.5)
  assert.deepEqual(second.tokens, callTwoTokens)
})
