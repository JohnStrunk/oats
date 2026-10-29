import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the new session shall load before the old read is released and remain displayed afterwards', function () {
  for (const snapshot of [this.beforeRelease, this.afterRelease]) {
    assert.equal(snapshot.sessionID, 'other')
    assert.deepEqual(snapshot.records.map((r) => r.sessionID), ['other'])
  }
})
