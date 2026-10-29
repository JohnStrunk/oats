import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { model, usage } from '../settlement_boundary_helper.js'

Then('the known prior attempt shall retain its identity at retry start', function () {
  const records = this.regressionHost.service.getSnapshot().records.filter((r) => r.sessionID === 'root' && r.messageID === 'retry-missing')
  assert.equal(records.length, 1, 'starting the retry must not create or reassign an earlier attempt')
  assert.equal(records[0].agent, 'first-agent')
  assert.deepEqual(records[0].model, model('first-model'))
  assert.equal(records[0].cost, 3)
  assert.deepEqual(records[0].tokens, usage(11))
})
