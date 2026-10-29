import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { MESSAGE_ID, totalTokens } from '../auto_compaction_helper.js'

Then('the overlapping compaction usage shall not be separately countable', function () {
  const before = this.liveCompactionSnapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(before.length, 1, 'fixture must establish the live summary')
  const snapshot = this.unframedCompactionSnapshot
  const records = snapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 1, 'neither the projection nor the unframed partial call may duplicate the live summary')
  assert.equal(records[0].cost, 2)
  assert.deepEqual(records[0].tokens, totalTokens)
  assert.ok(records[0].messageID === MESSAGE_ID || records[0].id === before[0].id, 'the reported summary must remain attributable')
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps.some((gap) => gap.sessionID === 'root' && /compaction/i.test(JSON.stringify(gap)) && /overlap|uncertain|partial|incomplete/i.test(JSON.stringify(gap))), 'the unframed overlap must be explicitly uncertain')
})
