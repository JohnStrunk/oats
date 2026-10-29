import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the snapshot shall not contain raw conversation content', function () {
  const snapshot = this.service.getSnapshot()
  assert.ok(snapshot.records.some((r) => r.messageID === 'private' && r.cost === 3))
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_'))
})
