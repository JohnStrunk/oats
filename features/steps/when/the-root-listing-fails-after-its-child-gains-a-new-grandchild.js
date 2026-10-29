import { When } from '@cucumber/cucumber'
import { session, message } from '../regression_session_helper.js'

When('the root listing fails after its child gains a new grandchild', async function () {
  const state = this.treeState
  // The formerly verified link is no longer true in the host. The failed root
  // listing prevents OATS from establishing whether the old child is in scope.
  state.sessions.find((s) => s.id === 'child').parentID = 'other'
  state.sessions.push(session('new-grandchild', 'child'))
  state.messages['new-grandchild'] = [message('new-grandchild-message', 17)]
  state.failures.add('session:root:0')
  await this.service.refresh()
  this.failedTreeSnapshot = structuredClone(this.service.getSnapshot())
})
