import { When } from '@cucumber/cucumber'
import { emitStart, projectEnd, stepEvent, usage } from '../settlement_boundary_helper.js'

When('a historical completion is also delivered as a live settlement', async function () {
  const h = this.regressionHost
  const completed = 1700000000200
  await h.service.refresh()
  emitStart(h, 'root', 'same-attempt', 41, 1700000000100, 'worker', 'model-a')
  // The host projection is visible to a history read before its live terminal
  // notification reaches this subscriber. No stale response is assumed.
  projectEnd(h, 'root', 'same-attempt', completed, 3, usage(11))
  await h.service.refresh()
  h.emit(stepEvent('session.step.ended', 'root', 'same-attempt', 42, completed, {
    finish: 'stop', cost: 3, tokens: usage(11),
  }))
  this.beforeBoundaryRefresh = h.service.getSnapshot()
  await h.service.refresh()
})
