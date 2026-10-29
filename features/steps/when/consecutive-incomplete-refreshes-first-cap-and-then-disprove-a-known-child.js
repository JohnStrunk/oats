import { When } from '@cucumber/cucumber'
import { session } from '../regression_session_helper.js'

When('consecutive incomplete refreshes first cap and then disprove a known child', async function () {
  await this.service.refresh()
  this.consecutiveBaseline = structuredClone(this.service.getSnapshot())
  const targetIndex = this.host.sessions.findIndex((s) => s.id === 'child2')
  this.host.sessions.splice(targetIndex, 0, session('new-a', 'root'), session('new-b', 'root'))
  this.host.calls.length = 0
  await this.service.refresh()
  this.cappedSnapshot = structuredClone(this.service.getSnapshot())
  this.cappedCalls = structuredClone(this.host.calls)

  this.host.sessions = this.host.sessions.filter((s) => !['new-a', 'new-b', 'child2'].includes(s.id))
  this.host.failures.add('session:child:0')
  this.host.calls.length = 0
  await this.service.refresh()
  this.disprovedSnapshot = structuredClone(this.service.getSnapshot())
})
