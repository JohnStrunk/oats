import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the blocked route snapshot shall not expose the previous session subtree', function () {
  const snapshot = this.blockedRouteSnapshots.intermediate
  assert.ok(Array.isArray(snapshot.records), 'snapshot must expose records')
  assert.ok(snapshot.records.every((record) => record.sessionID === 'new-root'), 'previous session subtree records must not be exposed')
  assert.ok(snapshot.sessionID == null || snapshot.sessionID === 'new-root', 'snapshot must not identify the previous session as displayed')
  assert.ok(snapshot.records.length === 0 || snapshot.loading === true || snapshot.complete === false, 'a nonempty snapshot must indicate the pending load')
})
