import { When } from '@cucumber/cucumber'

When("a confirmed sibling is removed and the retained child's listing fails", async function () {
  await this.service.refresh()
  this.siblingBaseline = structuredClone(this.service.getSnapshot())
  this.host.calls.length = 0
  this.host.sessions.find((s) => s.id === 'child2').parentID = 'other'
  this.host.failures.add('session:child:0')
  await this.service.refresh()
  this.siblingSnapshot = structuredClone(this.service.getSnapshot())
})
