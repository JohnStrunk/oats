import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('previously confirmed records shall remain without the unverified grandchild history', function () {
  assert.ok(this.treeBaseline.records.some((record) => record.sessionID === 'child'), 'fixture must establish known child history')
  for (const record of this.treeBaseline.records) {
    const current = this.failedTreeSnapshot.records.find((item) => item.id === record.id)
    assert.deepEqual(current, record, `lost or changed known record ${record.id}`)
  }
  assert.ok(!this.failedTreeSnapshot.records.some((record) => record.sessionID === 'new-grandchild'), 'new history under an unverified ancestor is outside proven scope')
  assert.equal(this.failedTreeSnapshot.complete, false)
  assert.ok(this.failedTreeSnapshot.errors.some((error) => error.operation === 'session.list' && error.sessionID === 'root'), 'the failed root listing must be reported')
})
