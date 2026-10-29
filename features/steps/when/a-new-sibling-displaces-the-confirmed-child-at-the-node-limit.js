import { When } from '@cucumber/cucumber'

When('a new sibling displaces the confirmed child at the node limit', async function () {
  const h = this.retentionHost
  h.state.sessions.unshift(h.session('new-sibling', 'root'))
  h.state.messages['new-sibling'] = []
  await h.service.refresh()
  this.retentionSnapshot = structuredClone(h.service.getSnapshot())
})
