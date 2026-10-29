import { When } from '@cucumber/cucumber'

When('the synthetic hierarchy is refreshed in the {string} case', async function (kind) {
  if (kind === 'authoritative moved lineage') this.host.sessions.find((s) => s.id === 'g').parentID = 'a'
  this.host.failures.add('session:b:0')
  this.host.listings.length = 0
  await this.service.refresh()
  this.lineageMiddle = structuredClone(this.service.getSnapshot())
  this.lineageMiddleListings = structuredClone(this.host.listings)

  // Model removal of a and, in the moved case, its descendant as well.
  this.host.sessions = this.host.sessions.filter((s) => s.id !== 'a' && (kind !== 'authoritative moved lineage' || s.id !== 'g'))
  this.host.listings.length = 0
  await this.service.refresh()
  this.lineageFinal = structuredClone(this.service.getSnapshot())
  this.lineageFinalListings = structuredClone(this.host.listings)
})
