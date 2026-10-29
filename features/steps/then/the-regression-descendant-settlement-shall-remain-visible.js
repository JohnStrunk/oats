import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { model, tokens } from '../regression_session_helper.js'
Then('the regression descendant settlement shall remain visible', function () {
  const records = this.regressionHost.service.getSnapshot().records.filter((r) => r.sessionID === 'child' && r.messageID === 'live')
  assert.equal(records.length, 1)
  assert.equal(records[0].agent, 'worker')
  assert.deepEqual(records[0].model, model('worker-model'))
  assert.equal(records[0].cost, 9)
  assert.deepEqual(records[0].tokens, tokens(9))
})
