import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { MESSAGE_ID, totalTokens } from '../auto_compaction_helper.js'

Then('the automatic compaction without a persisted call log shall appear once', function () {
  const before = this.autoCompactionBeforeRefresh.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(before.length, 1, 'the live terminal must expose its usage')
  assert.equal(before[0].cost, 2)
  assert.deepEqual(before[0].tokens, totalTokens)
  const records = this.regressionHost.service.getSnapshot().records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 1, 'the projection and terminal must not be counted twice')
  assert.equal(records[0].messageID, MESSAGE_ID)
  assert.equal(records[0].cost, 2)
  assert.deepEqual(records[0].tokens, totalTokens)
})
