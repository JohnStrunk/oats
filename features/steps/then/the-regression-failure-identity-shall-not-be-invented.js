import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { model } from '../regression_session_helper.js'
Then('the regression failure identity shall not be invented', function () {
  const records = this.regressionHost.service.getSnapshot().records.filter((r) => r.messageID === 'retry')
  assert.equal(records.length, 2)
  const first = records.find((r) => r.cost === 3)
  const retry = records.find((r) => r.cost === 7)
  assert.ok(first); assert.ok(retry)
  assert.equal(first.agent, null); assert.equal(first.model, null)
  assert.equal(retry.agent, 'retry-agent'); assert.deepEqual(retry.model, model('retry-model'))
})
