import { hostFixture, makeService } from './session_data_helper.js'
import { After } from '@cucumber/cucumber'

After(function () { this.bounded?.stop() })

// A deliberately small injected limit makes boundedness observable without
// depending on production defaults. The host supplies real client responses;
// it never manufactures the system's snapshot or its failure indication.
export async function boundedHost() {
  const { state, context } = hostFixture('tree with paginated history')
  context.sessionDataLimits = { timeoutMs: 40, maxPages: 3, maxLogEvents: 3 }
  const service = await makeService(context)
  await service.refresh()
  const baseline = structuredClone(service.getSnapshot())
  const originals = {
    children: context.client.session.list,
    messages: context.client.message.list,
    log: context.client.session.log,
  }
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let stopped = false
  let calls = 0
  let fault
  let repeatedCursor = 'repeated'
  const pause = () => new Promise((resolve) => setTimeout(resolve, 10))
  context.client.session.list = async (query) => {
    if (query.parentID !== 'root' || !fault || stopped) return originals.children(query)
    if (fault === 'stalled child page') { await gate; return originals.children(query) }
    if (!['endless child pages', 'repeated child page'].includes(fault)) return originals.children(query)
    await pause()
    if (stopped) return originals.children(query)
    if (++calls > 200) throw new Error('fixture safety ceiling reached')
    return { data: [state.sessions.find((s) => s.id === 'child')], cursor: { next: fault === 'repeated child page' ? repeatedCursor : `child-cursor-${calls}` } }
  }
  context.client.message.list = async (query) => {
    if (query.sessionID !== 'root' || !fault || stopped) return originals.messages(query)
    if (fault === 'stalled message page') { await gate; return originals.messages(query) }
    if (!['endless message pages', 'repeated message page'].includes(fault)) return originals.messages(query)
    await pause()
    if (stopped) return originals.messages(query)
    if (++calls > 200) throw new Error('fixture safety ceiling reached')
    return { data: [structuredClone(state.messages.root[0])], cursor: { next: fault === 'repeated message page' ? repeatedCursor : `message-cursor-${calls}` } }
  }
  context.client.session.log = (query) => {
    if (query.sessionID !== 'root' || !['stalled session log', 'endless session log'].includes(fault) || stopped) return originals.log(query)
    return (async function* () {
      if (fault === 'stalled session log') await gate
      else while (!stopped) {
        await pause()
        if (!stopped) yield { type: 'log.synced', aggregateID: query.sessionID }
      }
      yield* originals.log(query)
    })()
  }
  return {
    state, service, baseline,
    setFault(value) { fault = value },
    setRepeatedCursor(value) { repeatedCursor = value },
    stop() { stopped = true; release() },
  }
}

// A watchdog makes a failing implementation terminate instead of hanging the
// acceptance runner. It is not the timeout being tested.
export async function boundedRefresh(service) {
  let timer
  try {
    return await Promise.race([
      service.refresh().then(() => true),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), 1200) }),
    ])
  } finally { clearTimeout(timer) }
}
