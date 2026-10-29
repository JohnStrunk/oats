import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('both step attempt records shall remain distinct after a refresh', function () {
  const records = this.service.getSnapshot().records.filter((r) => r.sessionID === 'root' && r.messageID === 'retry')
  assert.deepEqual(records.map((r) => r.cost).sort(), [1, 2])
  assert.equal(new Set(records.map((r) => r.id)).size, 2)
  for (const record of records) { assert.equal(record.agent, 'alpha'); assert.deepEqual(record.model, { providerID: 'provider', id: 'old' }) }
})
