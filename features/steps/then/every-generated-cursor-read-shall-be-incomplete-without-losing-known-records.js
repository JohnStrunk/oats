import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('every generated cursor read shall be incomplete without losing known records', function () {
  assert.equal(this.generatedReads.length, 8)
  for (const { cursor, finished, before, after } of this.generatedReads) {
    assert.equal(finished, true, `refresh hung for cursor ${JSON.stringify(cursor)}`)
    assert.equal(after.complete, false)
    assert.ok(after.errors.some((error) => error.operation === 'message.list' && error.sessionID === 'root'), `missing cursor failure for ${JSON.stringify(cursor)}`)
    for (const record of before.records) assert.deepEqual(after.records.find((item) => item.id === record.id), record)
  }
})
