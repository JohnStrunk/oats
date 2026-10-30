import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the session data snapshot shall contain a retry ambiguity gap', function () {
  const snapshot = this.regressionHost.service.getSnapshot()
  assert.ok(snapshot.gaps.some((gap) => gap.kind === 'retry-usage-ambiguous' && gap.sessionID === 'root' && gap.messageID === 'retry-missing'))
})
