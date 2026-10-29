import { When } from '@cucumber/cucumber'
import { session } from '../regression_session_helper.js'

When("a capped grandchild's ancestor is removed and another branch listing fails", async function () {
  await this.service.refresh()
  this.descendantBaseline = structuredClone(this.service.getSnapshot())

  // Four root children exceed the four-node cap (including the root), so
  // traversal stops before the existing child's children can be listed.
  this.host.sessions.push(session('cap-a', 'root'), session('cap-b', 'root'))
  this.host.calls.length = 0
  await this.service.refresh()
  this.descendantCapped = structuredClone(this.service.getSnapshot())
  this.descendantCappedCalls = structuredClone(this.host.calls)

  // The child and its own child still exist, but the child moves elsewhere.
  // The other existing branch is now uncertain due to a listing failure.
  this.host.sessions = this.host.sessions.filter((s) => !['cap-a', 'cap-b'].includes(s.id))
  this.host.sessions.find((s) => s.id === 'child').parentID = 'other'
  this.host.failures.add('session:child2:0')
  this.host.calls.length = 0
  await this.service.refresh()
  this.descendantFinal = structuredClone(this.service.getSnapshot())
  this.descendantFinalCalls = structuredClone(this.host.calls)
})
