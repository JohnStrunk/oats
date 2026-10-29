import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { model, tokens } from '../followup_major_host.js'

// Gap metadata may vary, but its structured contents must retain the call's
// independently reported cost and tokens together.
function containsUsage(value, cost, usage) {
  if (value === null || typeof value !== 'object') return false
  if (value.cost === cost && value.tokens) {
    try { assert.deepEqual(value.tokens, usage); return true } catch { /* inspect children */ }
  }
  return Object.values(value).some((child) => containsUsage(child, cost, usage))
}

Then('the follow-up snapshot shall satisfy the {string} case', function (kind) {
  const snapshot = this.followupSnapshot
  const records = snapshot.records
  if (kind.startsWith('delayed retry')) {
    const attempts = records.filter((r) => r.sessionID === 'root' && r.messageID === 'msg-retry')
    const retry = attempts.find((r) => r.agent === 'retry-agent')
    assert.ok(retry, 'the live retry must remain attributable')
    if (kind === 'delayed retry failure') {
      assert.equal(retry.cost, null, 'the retry must not inherit the earlier cost')
      assert.equal(retry.tokens, null, 'the retry must not inherit the earlier tokens')
      assert.ok(snapshot.gaps.some((g) => g.kind === 'missing-usage' && g.messageID === 'msg-retry'))
    }
    assert.equal(attempts.length, 2, 'the historical attempt and retry must remain distinct')
    const old = attempts.find((r) => r.agent === 'old-agent')
    assert.ok(old)
    assert.notEqual(old.id, retry.id)
    assert.deepEqual(old.model, model('old-model')); assert.equal(old.cost, 3); assert.deepEqual(old.tokens, tokens(7))
    assert.deepEqual(retry.model, model('retry-model'))
    if (kind === 'delayed retry success') { assert.equal(retry.cost, 5); assert.deepEqual(retry.tokens, tokens(11)) }
  } else if (kind === 'partial zero cost') {
    const compactions = records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
    assert.equal(compactions.length, 1, 'partial constituent usage must not be separately countable')
    const [original] = compactions
    assert.equal(original.messageID, 'msg-zero-start', 'a partial zero-cost log cannot replace the full summary')
    assert.equal(original.cost, 0); assert.deepEqual(original.tokens, tokens(9))
    assert.ok(!records.some((r) => r.eventID === 'evt-zero-call'), 'the partial constituent must not appear as a countable record')
    assert.equal(snapshot.complete, false)
    const overlaps = snapshot.gaps.filter((gap) => {
      const text = JSON.stringify(gap)
      return gap.sessionID === 'root' && /compaction/i.test(text) && /partial|incomplete|overlap|uncertain/i.test(text)
    })
    assert.ok(overlaps.length, 'a session-specific gap must explain the incomplete compaction overlap')
    assert.ok(overlaps.some((gap) => containsUsage(gap, 0, tokens(2))), 'the gap must preserve the partial zero-cost call and its tokens')
  } else if (kind === 'unrelated equal usage') {
    const compactions = records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
    assert.equal(compactions.length, 2, 'only the earlier summary and the later call may be countable')
    const earlier = compactions.find((r) => r.messageID === 'msg-earlier')
    assert.ok(earlier, 'earlier summary must not be consumed by later call')
    assert.equal(earlier.cost, 2); assert.deepEqual(earlier.tokens, tokens(8))
    const later = compactions.find((r) => r.eventID === 'evt-later-call')
    assert.ok(later, 'the later call must remain countable')
    assert.equal(later.cost, 2); assert.deepEqual(later.tokens, tokens(8))
    assert.ok(!compactions.some((r) => r.messageID === 'msg-later'), 'the later summary must not duplicate its call')
  } else if (kind === 'cross-session timestamp' || kind === 'cross-session live projection') {
    const root = records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
    const child = records.filter((r) => r.sessionID === 'child' && r.source === 'compaction')
    assert.equal(root.length, 1, 'root compaction remains once')
    assert.equal(root[0].cost, 4); assert.deepEqual(root[0].tokens, tokens(4))
    assert.equal(child.length, 1, 'child call remains once')
    assert.equal(child[0].cost, 2); assert.deepEqual(child[0].tokens, tokens(2))
    if (kind === 'cross-session live projection') {
      assert.equal(root[0].messageID, 'msg-root-start')
      assert.equal(child[0].messageID, 'msg-child-start')
    }
  } else throw new Error(`Unknown follow-up case: ${kind}`)
})
