import { After } from '@cucumber/cucumber'
import { hostFixture, makeService } from './session_data_helper.js'
import { session } from './regression_session_helper.js'

export async function retentionHost(kind) {
  const { state, context } = hostFixture('tree with paginated history')
  const allowed = kind === 'stale grandchild' ? ['root', 'child', 'grandchild'] : ['root', 'child']
  state.sessions = state.sessions.filter((item) => allowed.includes(item.id))
  if (kind === 'node limit') context.sessionDataLimits = { maxSubtreeNodes: 2 }
  if (kind === 'separate compactions') {
    state.messages.root = []
    state.messages.child = []
  }
  const service = await makeService(context)
  await service.refresh()
  return { state, context, service, baseline: structuredClone(service.getSnapshot()), session }
}

After(function () { this.retentionHost?.service.dispose() })
