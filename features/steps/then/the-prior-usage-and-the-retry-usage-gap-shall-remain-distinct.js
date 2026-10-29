import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { model, usage } from '../settlement_boundary_helper.js'

Then('the prior usage and the retry usage gap shall remain distinct', function () {
  for (const snapshot of [this.beforeBoundaryRefresh, this.regressionHost.service.getSnapshot()]) {
    const records = snapshot.records.filter((r) => r.sessionID === 'root' && r.messageID === 'retry-missing')
    assert.equal(records.length, 2, 'one prior attempt and one failed retry must be visible')
    const prior = records.find((r) => r.agent === 'first-agent')
    const retry = records.find((r) => r.agent === 'retry-agent')
    assert.ok(prior && retry, 'both attempt identities must be retained')
    assert.deepEqual(prior.model, model('first-model'))
    assert.equal(prior.cost, 3)
    assert.deepEqual(prior.tokens, usage(11))
    assert.equal(records.filter((r) => r.cost === 3).length, 1, 'known prior cost must appear exactly once')
    assert.deepEqual(retry.model, model('retry-model'))
    assert.equal(retry.cost ?? null, null, 'retry cost must remain unknown')
    assert.equal(retry.tokens ?? null, null, 'retry tokens must remain unknown')
    assert.ok(snapshot.gaps.some((gap) => gap.kind === 'missing-usage' && gap.messageID === 'retry-missing'))
  }
})
