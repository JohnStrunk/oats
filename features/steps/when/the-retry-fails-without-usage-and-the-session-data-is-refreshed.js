import { When } from '@cucumber/cucumber'
import { emitFailure } from '../settlement_boundary_helper.js'

When('the retry fails without usage and the session data is refreshed', async function () {
  const h = this.regressionHost
  emitFailure(h, 'root', 'retry-missing', 52, 1700000000400,
    { type: 'provider', message: 'failed before usage was reported' })
  this.beforeBoundaryRefresh = h.service.getSnapshot()
  await h.service.refresh()
})
