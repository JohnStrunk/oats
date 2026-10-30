import { After } from '@cucumber/cucumber'
import { hostFixture } from './session_data_helper.js'

// A host-side boundary fake: OATS's actual entrypoint, data access and
// aggregation remain real. Claims record the documented TUI slot interface;
// registering a claim alone does not establish that anything was rendered.
export function sidebarHost() {
  const fixture = hostFixture('tree with paginated history')
  const claims = []
  fixture.context.ui.toast = { show() {} }
  fixture.context.ui.slot = claim => {
    claims.push(claim)
    return () => {
      const index = claims.indexOf(claim)
      if (index >= 0) claims.splice(index, 1)
    }
  }
  return { ...fixture, claims }
}

After(function () {
  this.sidebarDispose?.()
  this.sidebarDispose = undefined
})
