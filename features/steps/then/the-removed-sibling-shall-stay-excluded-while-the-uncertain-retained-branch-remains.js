import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the removed sibling shall stay excluded while the uncertain retained branch remains', function () {
  const prior = this.siblingBaseline
  const sibling = prior.records.find((r) => r.sessionID === 'child2' && r.messageID === 'child2-1')
  const grandchild = prior.records.find((r) => r.sessionID === 'grandchild' && r.messageID === 'grand-1')
  assert.ok(sibling && grandchild, 'the initial refresh must establish both branches')
  assert.ok(this.host.calls.some(([kind, id]) => kind === 'session' && id === 'root'), 'the root listing must be requested')
  const snapshot = this.siblingSnapshot
  assert.ok(!snapshot.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'root'), 'the root listing must succeed')
  assert.deepEqual(snapshot.records.filter((r) => r.id === grandchild.id), [grandchild], 'previously known work under the uncertain branch must remain')
  assert.ok(snapshot.records.some((r) => r.sessionID === 'child' && r.messageID === 'child-1'))
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'child'), 'the failed child listing must be reported')
  assert.ok(!snapshot.records.some((r) => r.sessionID === 'child2'), 'the excluded sibling must not reappear')
})
