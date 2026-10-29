import { When } from '@cucumber/cucumber'
import { event, model, session, summary, tokens } from '../followup_major_host.js'

When('the follow-up host runs the {string} case', async function (kind) {
  const h = this.followupHost
  const t = 1700000000000
  if (kind.startsWith('delayed retry')) {
    h.messages.root = [{ id: 'msg-retry', type: 'assistant', content: [], agent: 'old-agent', model: model('old-model'), time: { created: t, completed: t + 10 }, finish: 'error', cost: 3, tokens: tokens(7) }]
    const entered = h.block()
    const refresh = h.service.refresh()
    await entered
    h.emit(event('root', 'evt-retry-start', 'session.step.started', 3, t + 20, { assistantMessageID: 'msg-retry', agent: 'retry-agent', model: model('retry-model'), started: t + 20 }))
    // V2 reuses the assistant projection for the retry, leaving old usage in
    // place until a terminal reports replacements.
    const projection = h.messages.root[0]
    Object.assign(projection, { agent: 'retry-agent', model: model('retry-model'), time: { created: t + 20, completed: t + 30 } })
    const success = kind === 'delayed retry success'
    if (success) Object.assign(projection, { cost: 5, tokens: tokens(11), finish: 'stop' })
    else Object.assign(projection, { finish: 'error', error: { type: 'provider', message: 'failed' } })
    h.emit(event('root', 'evt-retry-terminal', success ? 'session.step.ended' : 'session.step.failed', 4, t + 30, { assistantMessageID: 'msg-retry', ...(success ? { finish: 'stop', cost: 5, tokens: tokens(11) } : { error: { type: 'provider', message: 'failed' } }) }))
    h.release()
    await refresh
  } else if (kind === 'partial zero cost') {
    const start = event('root', 'evt-zero-start', 'session.compaction.started', 1, t, { reason: 'auto', recent: '' })
    const call = event('root', 'evt-zero-call', 'session.usage.recorded', 2, t + 1, { source: 'compaction', cost: 0, tokens: tokens(2) })
    const end = event('root', 'evt-zero-end', 'session.compaction.ended', 4, t + 3, { reason: 'auto', text: 'summary', recent: '', cost: 0, tokens: tokens(9) })
    h.messages.root = [summary('msg-zero-start', t, 0, tokens(9))]
    h.logs.root = [start, call, end] // one lost usage event; aggregate tokens expose the gap
    await h.service.refresh()
  } else if (kind === 'unrelated equal usage') {
    h.messages.root = [summary('msg-earlier', t, 2, tokens(8)), summary('msg-later', t + 100, 2, tokens(8))]
    h.logs.root = [
      event('root', 'evt-later-start', 'session.compaction.started', 5, t + 100, { reason: 'auto', recent: '' }),
      event('root', 'evt-later-call', 'session.usage.recorded', 6, t + 101, { source: 'compaction', cost: 2, tokens: tokens(8) }),
      event('root', 'evt-later-end', 'session.compaction.ended', 7, t + 102, { reason: 'auto', text: 'summary', recent: '', cost: 2, tokens: tokens(8) }),
    ]
    await h.service.refresh()
  } else if (kind === 'cross-session timestamp') {
    h.sessions.push(session('child', 'root'))
    await h.service.refresh()
    h.emit(event('root', 'evt-root-start', 'session.compaction.started', 1, t, { reason: 'auto', recent: '' }))
    h.emit(event('root', 'evt-root-end', 'session.compaction.ended', 2, t + 10, { reason: 'auto', text: 'root', recent: '', cost: 4, tokens: tokens(4) }))
    h.messages.root = [summary('msg-root-start', t, 4, tokens(4))]
    h.messages.child = [summary('msg-child-start', t, 2, tokens(2))]
    h.logs.child = [
      event('child', 'evt-child-start', 'session.compaction.started', 1, t, { reason: 'auto', recent: '' }),
      event('child', 'evt-child-call', 'session.usage.recorded', 2, t + 1, { source: 'compaction', cost: 2, tokens: tokens(2) }),
      event('child', 'evt-child-end', 'session.compaction.ended', 3, t + 10, { reason: 'auto', text: 'child', recent: '', cost: 2, tokens: tokens(2) }),
    ]
    await h.service.refresh()
  } else if (kind === 'cross-session live projection') {
    h.sessions.push(session('child', 'root'))
    h.messages.root = [summary('msg-root-start', t, 4, tokens(4))]
    await h.service.refresh()
    h.emit(event('child', 'evt-child-start', 'session.compaction.started', 1, t, { reason: 'auto', recent: '' }))
    h.messages.child = [summary('msg-child-start', t, 2, tokens(2))]
    h.emit(event('child', 'evt-child-end', 'session.compaction.ended', 2, t + 10, { reason: 'auto', text: 'child', recent: '', cost: 2, tokens: tokens(2) }))
    await h.service.refresh()
  } else throw new Error(`Unknown follow-up case: ${kind}`)
  this.followupSnapshot = h.service.getSnapshot()
})
