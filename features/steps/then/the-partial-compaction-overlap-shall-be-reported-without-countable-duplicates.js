import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { MESSAGE_ID, callOneTokens, totalTokens } from '../auto_compaction_helper.js'

// The exact gap metadata shape is not prescribed; the known partial call's
// values must nevertheless remain available in that structured indication.
function containsUsage(value, expectedCost, expectedTokens) {
  if (value === null || typeof value !== 'object') return false
  if (value.cost === expectedCost && value.tokens) {
    try { assert.deepEqual(value.tokens, expectedTokens); return true } catch { /* continue */ }
  }
  return Object.values(value).some((child) => containsUsage(child, expectedCost, expectedTokens))
}

Then('the partial compaction overlap shall be reported without countable duplicates', function () {
  const snapshot = this.regressionHost.service.getSnapshot()
  const records = snapshot.records.filter((r) => r.sessionID === 'root' && r.source === 'compaction')
  assert.equal(records.length, 1, 'the summary and its partial constituent must not be separately countable')
  const summary = records.filter((r) => r.messageID === MESSAGE_ID)
  assert.equal(summary.length, 1, 'partial calls do not justify suppressing the full reported summary')
  assert.equal(summary[0].cost, 2)
  assert.deepEqual(summary[0].tokens, totalTokens)
  assert.equal(summary[0].agent ?? null, null, 'the host did not identify an agent')
  assert.equal(summary[0].model ?? null, null, 'the host did not identify a model')
  assert.equal(snapshot.complete, false)
  const overlaps = snapshot.gaps.filter((gap) => {
    const text = JSON.stringify(gap)
    return gap.sessionID === 'root' && /compaction/i.test(text) && /partial|incomplete|overlap|uncertain/i.test(text)
  })
  assert.ok(overlaps.length, 'a session-specific gap must explain the incomplete compaction overlap')
  assert.ok(overlaps.some((gap) => containsUsage(gap, 0.5, callOneTokens)), 'the gap must preserve the known partial call usage without making it another countable record')
})
