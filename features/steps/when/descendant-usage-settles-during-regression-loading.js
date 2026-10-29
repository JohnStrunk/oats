import { When } from '@cucumber/cucumber'
import { event, finish, message, session, start, until } from '../regression_session_helper.js'
When('descendant usage settles during {string} regression loading', async function (phase) {
  const h = this.regressionHost
  if (phase === 'initial subtree') {
    h.sessions.push(session('child', 'root'))
    h.messages.child = [message('sentinel', 1)]
    const gate = h.blockChildren('root')
    const loading = h.service.refresh()
    try {
      await gate.started
      start(h, 'child', 'live', 2, 'worker', 'worker-model')
      finish(h, 'child', 'live', 3, 9)
    } finally { gate.release() }
    await loading
  } else if (phase === 'child creation') {
    await h.service.refresh()
    h.sessions.push(session('child', 'root'))
    h.messages.child = [message('sentinel', 1)]
    const gate = h.blockChildren('root')
    try {
      h.emit(event('child-created', 'session.created', 1, { sessionID: 'child', parentID: 'root', projectID: 'project', location: { directory: '/workspace' }, slug: 'child', version: '2.0.32' }))
      await gate.started
      start(h, 'child', 'live', 2, 'worker', 'worker-model')
      finish(h, 'child', 'live', 3, 9)
    } finally { gate.release() }
    await until(() => h.service.getSnapshot().records.some((r) => r.messageID === 'sentinel'))
  } else throw new Error(`Unknown loading phase: ${phase}`)
})
