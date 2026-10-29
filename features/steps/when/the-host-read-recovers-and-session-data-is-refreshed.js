import { When } from '@cucumber/cucumber'
import { boundedRefresh } from '../bounded_session_reads_helper.js'

When('the host read recovers and session data is refreshed', async function () {
  const host = this.bounded.state
  const fresh = structuredClone(host.messages.root[0])
  fresh.id = 'new-after-recovery'
  fresh.cost = 42
  host.messages.root.push(fresh)
  host.sessions.push({ ...structuredClone(host.sessions.find((s) => s.id === 'child')), id: 'new-child', parentID: 'root' })
  host.messages['new-child'] = [{ ...structuredClone(fresh), id: 'new-child-message' }]
  host.logs.root = [{ id: 'recovered-usage', type: 'session.usage.recorded', data: { sessionID: 'root', source: 'title', cost: 17, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } } }]
  this.recoveredFinished = await boundedRefresh(this.service)
  this.recovered = structuredClone(this.service.getSnapshot())
})
