import { When } from '@cucumber/cucumber'
import { session } from '../regression_session_helper.js'
import { emitEnd, emitStart, usage } from '../settlement_boundary_helper.js'

When('nested and unrelated settlements arrive during root loading', async function () {
  const h = this.regressionHost
  h.sessions.push(session('root'), session('child', 'root'), session('grandchild', 'child'), session('unrelated'))
  // Capture the descendant's empty history before the settlement. The host
  // then updates its message projection while that stale response is blocked.
  const gate = h.blockMessageRead('grandchild')
  const loading = h.service.refresh()
  try {
    await gate.started
    emitStart(h, 'grandchild', 'nested-live', 7, 1700000000100, 'nested-agent', 'nested-model')
    emitEnd(h, 'grandchild', 'nested-live', 8, 1700000000200, 5, usage(17))
    emitStart(h, 'unrelated', 'outside-live', 30, 1700000000300, 'outside-agent', 'outside-model')
    emitEnd(h, 'unrelated', 'outside-live', 31, 1700000000400, 9, usage(23))
  } finally {
    gate.release()
  }
  await loading
  this.rootBoundarySnapshot = h.service.getSnapshot()
  h.route = { type: 'session', sessionID: 'unrelated' }
  await h.service.refresh()
  this.unrelatedBoundarySnapshot = h.service.getSnapshot()
  h.route = { type: 'session', sessionID: 'root' }
  await h.service.refresh()
})
