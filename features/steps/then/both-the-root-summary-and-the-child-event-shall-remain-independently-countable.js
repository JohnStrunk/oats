import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { tokens } from '../regression_session_helper.js'

Then('both the root summary and the child event shall remain independently countable', function () {
  const snapshot = this.retentionSnapshot
  const root = snapshot.records.filter((r) => r.sessionID === 'root' && r.messageID === 'root-compact' && r.source === 'compaction')
  const child = snapshot.records.filter((r) => r.sessionID === 'child' && r.eventID === 'child-compact-call' && r.source === 'compaction')
  assert.equal(root.length, 1)
  assert.equal(root[0].cost, 2)
  assert.deepEqual(root[0].tokens, tokens(2))
  assert.equal(child.length, 1)
  assert.equal(child[0].cost, 7)
  assert.deepEqual(child[0].tokens, tokens(7))
  assert.notEqual(root[0].id, child[0].id)
  assert.ok(!snapshot.gaps.some((g) => g.kind === 'compaction-usage-overlap' && g.sessionID === 'child' && g.eventID === 'child-compact-call'))
})
