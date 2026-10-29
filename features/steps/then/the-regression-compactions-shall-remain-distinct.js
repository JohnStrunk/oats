import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { tokens } from '../regression_session_helper.js'
Then('the regression compactions shall remain distinct', function () {
  for (const { cost, snapshot } of this.compactionSnapshots) {
    const records = snapshot.records.filter((r) => r.source === 'compaction')
    assert.equal(records.length, 2, `two separate compactions with cost ${cost}`)
    assert.equal(new Set(records.map((r) => r.id)).size, 2)
    assert.ok(records.every((r) => r.cost === cost))
    for (const record of records) assert.deepEqual(record.tokens, tokens(cost))
    assert.ok(!JSON.stringify(snapshot).includes('SECRET_'), 'compaction summary and recent text must not be exposed')
  }
})
