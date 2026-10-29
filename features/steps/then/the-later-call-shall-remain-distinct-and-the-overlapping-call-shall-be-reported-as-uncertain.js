import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { CALL_ONE_ID, MESSAGE_ID, callOneTokens, totalTokens } from '../auto_compaction_helper.js'
import { tokens } from '../regression_session_helper.js'

Then('the later call shall remain distinct and the overlapping call shall be reported as uncertain', function () {
  const live = this.windowLiveSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(live.length, 1, 'the live summary must be witnessed before refresh')
  assert.equal(live[0].cost, 2)
  const projection = this.regressionHost.messages.root.find((m) => m.id === MESSAGE_ID)
  assert.ok(projection && projection.time.completed === undefined, 'the matching host projection has no completion time')
  const snapshot = this.windowRefreshSnapshot
  const records = snapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 2, 'only the summary and later independent call are countable')
  const summary = records.filter((r) => r.messageID === MESSAGE_ID)
  assert.equal(summary.length, 1)
  assert.equal(summary[0].cost, 2)
  assert.deepEqual(summary[0].tokens, totalTokens)
  const later = records.filter((r) => r.eventID === 'evt_later_distinct_025')
  assert.equal(later.length, 1)
  assert.equal(later[0].cost, 7)
  assert.deepEqual(later[0].tokens, tokens(7))
  assert.ok(!records.some((r) => r.eventID === CALL_ONE_ID))
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps.some((g) => g.sessionID === 'root' && g.eventID === CALL_ONE_ID && /overlap|uncertain|incomplete/i.test(g.kind) && g.cost === 0.5 && JSON.stringify(g.tokens) === JSON.stringify(callOneTokens)), 'the ambiguous call must be preserved in an explicit gap')
  assert.ok(!snapshot.gaps.some((g) => g.eventID === 'evt_later_distinct_025' && /overlap|uncertain|incomplete/i.test(g.kind)), 'the call after the witnessed end is not ambiguous')
})
