import { Given } from '@cucumber/cucumber'
import { hostFixture, makeService } from '../session_data_helper.js'
import '../session_data_hooks.js'

Given('a session tree with a four-node traversal limit', async function () {
  const { state, context } = hostFixture('tree with paginated history')
  context.sessionDataLimits = { maxSubtreeNodes: 4 }
  this.host = state
  this.service = await makeService(context)
})
