import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the disproved child shall be excluded while the uncertain branch remains', function () {
  const child = this.consecutiveBaseline.records.find((r) => r.sessionID === 'child2' && r.messageID === 'child2-1')
  const grandchild = this.consecutiveBaseline.records.find((r) => r.sessionID === 'grandchild' && r.messageID === 'grand-1')
  assert.ok(child && grandchild, 'both branches must be established by the initial refresh')
  assert.deepEqual(this.cappedSnapshot.records.filter((r) => r.id === child.id), [child])
  assert.equal(this.cappedSnapshot.complete, false)
  assert.ok(this.cappedSnapshot.errors.some((e) => e.operation === 'session.traversal' && e.sessionID === 'root' && /limit/i.test(e.message)))
  assert.ok(!this.cappedCalls.some(([kind, id]) => kind === 'message' && id === 'child2'), 'the cap must prevent a fresh child history read')
  assert.ok(this.host.calls.some(([kind, id]) => kind === 'session' && id === 'root'))
  assert.ok(!this.disprovedSnapshot.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'root'))
  assert.ok(this.disprovedSnapshot.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'child'))
  assert.equal(this.disprovedSnapshot.complete, false)
  assert.deepEqual(this.disprovedSnapshot.records.filter((r) => r.id === grandchild.id), [grandchild])
  assert.ok(!this.disprovedSnapshot.records.some((r) => r.sessionID === 'child2'), 'the successfully listed parent excludes the removed child')
})
