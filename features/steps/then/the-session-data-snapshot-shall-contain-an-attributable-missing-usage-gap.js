import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the session data snapshot shall contain an attributable missing usage gap', function () {
  const snapshot = this.service.getSnapshot()
  assert.ok(snapshot.gaps.some((gap) => gap.kind === 'missing-usage' && gap.sessionID === 'root' && gap.messageID === 'missing'))
  assert.ok(snapshot.records.some((record) => record.sessionID === 'root' && record.messageID === 'missing' && record.agent === 'alpha' && record.cost === null))
})
