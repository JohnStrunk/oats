import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the record IDs shall remain associated with the same records', function () {
  const byMessage = (snapshot) => new Map(snapshot.records.map((record) => [
    `${record.sessionID}/${record.messageID}`, record.id,
  ]))
  const before = this.snapshotBeforeRefresh
  const after = this.service.getSnapshot()
  assert.equal(before.sessionID, 'root')
  assert.equal(after.sessionID, 'root')
  assert.equal(before.records.length, 5)
  assert.equal(after.records.length, before.records.length)
  assert.ok(before.records.every((record) => typeof record.id === 'string' && record.id.length > 0))
  assert.equal(new Set(before.records.map((record) => record.id)).size, before.records.length)
  assert.equal(new Set(after.records.map((record) => record.id)).size, after.records.length)
  assert.deepEqual(byMessage(after), byMessage(before))
})
