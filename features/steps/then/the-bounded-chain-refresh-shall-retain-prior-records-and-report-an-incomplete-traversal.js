import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the bounded chain refresh shall retain prior records and report an incomplete traversal', function () {
  assert.equal(this.chainFinished, true, 'the refresh exceeded the independent watchdog')
  assert.ok(this.treeBaseline.records.some((record) => record.sessionID === 'child'), 'fixture must establish known descendant history')
  for (const record of this.treeBaseline.records) {
    const current = this.chainSnapshot.records.find((item) => item.id === record.id)
    assert.deepEqual(current, record, `lost or changed known record ${record.id}`)
  }
  assert.equal(this.chainSnapshot.complete, false)
  assert.ok(this.chainSnapshot.errors.some((error) => /subtree|node|travers/i.test(JSON.stringify(error)) && /limit|exceed|incomplete/i.test(JSON.stringify(error))), 'a structured error must identify the traversal limit')
  assert.ok(!this.chainSnapshot.errors.some((error) => /fixture safety ceiling/.test(JSON.stringify(error))), 'the fixture safety ceiling is not a system bound')
  assert.ok(this.chainCalls < 100, 'the system must bound the traversal before the fixture safety ceiling')
})
