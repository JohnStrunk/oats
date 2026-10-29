import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { until } from '../regression_session_helper.js'
Then('the failed compaction shall retain its known cost and indicate the usage gap', async function () {
  const service = this.regressionHost.service
  await until(() => service.getSnapshot().records.some((r) => r.source === 'compaction' && r.cost === 4))
  const snapshot = service.getSnapshot()
  const records = snapshot.records.filter((r) => r.source === 'compaction')
  assert.equal(records.length, 1)
  assert.equal(records[0].cost, 4)
  assert.ok(records[0].tokens == null)
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'missing-usage' && g.sessionID === 'root'))
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_'))
})
