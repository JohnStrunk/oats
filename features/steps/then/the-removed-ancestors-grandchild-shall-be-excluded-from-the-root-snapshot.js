import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then("the removed ancestor's grandchild shall be excluded from the root snapshot", function () {
  const grandchild = this.descendantBaseline.records.find((r) => r.sessionID === 'grandchild' && r.messageID === 'grand-1')
  const otherBranch = this.descendantBaseline.records.find((r) => r.sessionID === 'child2' && r.messageID === 'child2-1')
  assert.ok(grandchild && otherBranch, 'both branches must be established before the cap')
  assert.ok(this.descendantBaseline.records.some((r) => r.sessionID === 'child' && r.messageID === 'child-1'))

  assert.ok(this.descendantCapped.errors.some((e) => e.operation === 'session.traversal' && e.sessionID === 'root' && /limit/i.test(e.message)))
  assert.ok(!this.descendantCappedCalls.some(([kind, id]) => kind === 'session' && id === 'child'), 'the cap must prevent listing the ancestor')
  assert.ok(!this.descendantCappedCalls.some(([kind, id]) => kind === 'message' && id === 'grandchild'), 'the cap must prevent a fresh grandchild history read')
  assert.deepEqual(this.descendantCapped.records.filter((r) => r.id === grandchild.id), [grandchild], 'the cap must retain the known grandchild')

  assert.equal(this.descendantFinal.sessionID, 'root')
  assert.ok(this.descendantFinalCalls.some(([kind, id]) => kind === 'session' && id === 'root'))
  assert.ok(!this.descendantFinal.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'root'), 'the root listing must succeed')
  assert.ok(this.descendantFinal.errors.some((e) => e.operation === 'session.list' && e.sessionID === 'child2'), 'the other branch listing must fail')
  assert.equal(this.descendantFinal.complete, false)
  assert.deepEqual(this.descendantFinal.records.filter((r) => r.id === otherBranch.id), [otherBranch], 'the uncertain branch remains available')
  assert.ok(!this.descendantFinal.records.some((r) => r.sessionID === 'child'), 'the moved child is outside the root scope')
  assert.ok(!this.descendantFinal.records.some((r) => r.sessionID === 'grandchild'), 'the moved child\'s descendant is outside the root scope')
})
