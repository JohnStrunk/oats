import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('fork provenance uncertainty shall be indicated', function () {
  const snapshot = this.service.getSnapshot()
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'fork-provenance-uncertain' && g.sessionID === 'root'))
  assert.ok(snapshot.records.every((record) => record.sessionID !== 'root'), 'ambiguous historical fork records cannot be exposed as aggregatable records')
  assert.ok(snapshot.records.some((record) => record.sessionID === 'fork-child' && record.messageID === 'child-own'))
})
