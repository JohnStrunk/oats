import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { model, usage } from '../settlement_boundary_helper.js'

Then('the earlier attempt shall keep its original attribution after the running retry refresh', function () {
  const projection = this.runningRetryProjection
  assert.equal(projection.agent, 'retry-agent')
  assert.deepEqual(projection.model, model('retry-model'))
  assert.equal(projection.time.completed, undefined, 'retry must still be running')
  assert.equal(projection.cost, 3, 'the host projection still carries the earlier usage')
  assert.deepEqual(projection.tokens, usage(11))
  const baseline = this.beforeRunningRetryRefresh.records.filter((r) => r.messageID === 'retry-missing')
  assert.equal(baseline.length, 1)
  assert.equal(baseline[0].agent, 'first-agent')
  assert.deepEqual(baseline[0].model, model('first-model'))
  const records = this.runningRetrySnapshot.records.filter((r) => r.sessionID === 'root' && r.messageID === 'retry-missing')
  const prior = records.filter((r) => r.cost === 3)
  assert.equal(prior.length, 1, 'known previous usage must occur exactly once')
  assert.equal(prior[0].agent, 'first-agent')
  assert.deepEqual(prior[0].model, model('first-model'))
  assert.deepEqual(prior[0].tokens, usage(11))
  assert.ok(!records.some((r) => r.agent === 'retry-agent' && r.cost === 3), 'the retry must not inherit prior usage')
})
