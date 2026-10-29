import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the prior root and descendant records shall remain available after the incomplete read', function () {
  assert.equal(this.finished, true, 'refresh did not finish before the watchdog')
  const before = this.bounded.baseline.records
  assert.ok(before.some((record) => record.messageID === 'root-2'))
  assert.ok(before.some((record) => record.messageID === 'child-1'))
  for (const record of before) {
    assert.deepEqual(this.incomplete.records.find((item) => item.id === record.id), record, `lost or changed ${record.id}`)
  }
})
