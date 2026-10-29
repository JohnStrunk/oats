import { Given } from '@cucumber/cucumber'
import { hostFixture, makeService } from '../session_data_helper.js'
import '../session_data_hooks.js'

Given('a session tree host with confirmed prior records', async function () {
  const { state, context } = hostFixture('tree with paginated history')
  state.sessions = state.sessions.filter((session) => ['root', 'child'].includes(session.id))
  context.sessionDataLimits = { maxSubtreeNodes: 4, timeoutMs: 200, maxPages: 10, maxLogEvents: 10 }
  this.treeState = state
  this.treeContext = context
  this.service = await makeService(context)
  await this.service.refresh()
  this.treeBaseline = structuredClone(this.service.getSnapshot())
})
