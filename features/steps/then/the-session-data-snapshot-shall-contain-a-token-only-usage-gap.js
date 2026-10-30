import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the session data snapshot shall contain a token-only usage gap', function () {
  const snapshot = this.service.getSnapshot()
  assert.ok(snapshot.gaps.some((gap) => gap.kind === 'missing-usage' && gap.sessionID === 'root' && gap.messageID === 'root-1'))
  const record = snapshot.records.find((item) => item.sessionID === 'root' && item.messageID === 'root-1')
  assert.equal(record.cost, 1)
  assert.equal(record.tokens, null)
})
