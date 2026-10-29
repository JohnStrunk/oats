import assert from 'node:assert/strict'

// These fakes implement the OpenCode V2 promise-client and TUI boundaries, not
// the OATS transformation. Pagination uses opaque, filter-bound cursors and
// respects the requested limit (or the host's default page size).
const model = (id) => ({ providerID: 'provider', id })
const tokens = (n) => ({ input: n, output: n + 1, reasoning: 0, cache: { read: 0, write: 0 } })
const msg = (id, agent, modelID, cost, n) => ({
  id, type: 'assistant', time: { created: 1, completed: 2 }, content: [],
  ...(agent === undefined ? {} : { agent }),
  ...(modelID === undefined ? {} : { model: model(modelID) }),
  ...(cost === undefined ? {} : { cost }),
  ...(n === undefined ? {} : { tokens: tokens(n) }),
})
const session = (id, parentID) => ({ id, ...(parentID ? { parentID } : {}), agent: 'current-agent', model: model('current-model'), cost: 999, tokens: tokens(999), projectID: 'project', time: { created: 1, updated: 1 }, location: { directory: '/workspace' } })

export function hostFixture(name) {
  const state = {
    route: { type: 'session', sessionID: 'root' },
    sessions: [session('ancestor'), session('root', 'ancestor'), session('child', 'root'), session('child2', 'root'), session('grandchild', 'child'), session('other', 'ancestor')],
    messages: {
      ancestor: [msg('ancestor-m', 'ancestor', 'ancestor', 9, 9)],
      root: [msg('root-1', 'alpha', 'old', 1, 2), msg('root-2', 'beta', 'new', 2, 4)],
      child: [msg('child-1', 'worker', 'worker-model', 3, 6)],
      child2: [msg('child2-1', 'worker-two', 'worker-model', 3, 7)],
      grandchild: [msg('grand-1', 'nested', 'nested-model', 4, 8)],
      other: [msg('other-m', 'other', 'other', 10, 10)],
    },
    failures: new Set(), listeners: new Map(), calls: [], gate: undefined, logs: {},
  }
  if (name === 'recorded identities') state.sessions = [state.sessions[1]]
  if (name === 'missing and zero') {
    state.sessions = [state.sessions[1]]
    state.messages.root = [msg('zero', 'known', 'known-model', 0, 0), msg('missing', undefined, undefined, undefined, undefined)]
  }
  if (name === 'live settlement') {
    state.sessions = [state.sessions[1]]
    state.messages.root = [msg('live', 'alpha', 'old', undefined, undefined)]
    state.messages.root[0].time = { created: 1 }
  }
  if (name === 'switch') state.sessions.push(session('new-root'))
  if (name === 'switch') state.messages['new-root'] = [msg('new-m', 'new-agent', 'new-model', 5, 5)]
  if (name === 'failed later page' || name === 'pagination') {
    for (let i = 0; i < 201; i++) state.messages.root.push(msg(`root-extra-${String(i).padStart(3, '0')}`, 'alpha', 'old', i + 1, 2))
  }
  if (name === 'pagination') {
    for (let i = 0; i < 201; i++) state.sessions.push(session(`extra-child-${String(i).padStart(3, '0')}`, 'root'))
  }
  if (name === 'failed later page') state.failures.add('message:root:later')
  if (['startup race', 'retry attempts', 'usage events', 'multi-call compaction', 'compaction history', 'private data', 'fork before', 'fork through', 'ambiguous fork'].includes(name)) {
    state.sessions = [state.sessions[1]]
    state.messages.root = []
  }
  if (name === 'startup race') {
    state.messages.root = [msg('race', 'alpha', 'old', undefined, undefined)]
    state.messages.root[0].time = { created: 1 }
    let entered, release
    state.entered = new Promise((resolve) => { entered = resolve })
    const promise = new Promise((resolve) => { release = resolve })
    state.gate = { entered, promise }
    state.release = release
  }
  if (name === 'private data') {
    const message = msg('private', 'alpha', 'old', 3, 2)
    message.content = [{ type: 'text', text: 'SECRET_ASSISTANT_CONTENT_435' }]
    state.messages.root = [message, { id: 'user-1', type: 'user', time: { created: 1 }, text: 'SECRET_USER_PROMPT_435' }]
  }
  if (name === 'fork before' || name === 'fork through' || name === 'ambiguous fork') {
    state.sessions = [session('ancestor'), { ...session('root'), fork: { sessionID: 'ancestor', boundary: { type: name === 'fork before' ? 'before' : 'through', messageID: name === 'ambiguous fork' ? 'unavailable-boundary' : 'source-2' } } }, session('fork-child', 'root')]
    state.messages.ancestor = [msg('source-1', 'source', 'source', 1, 1), msg('source-2', 'source', 'source', 2, 2)]
    // Forking copies the messages with new IDs. Historical timestamps and
    // equal content cannot establish which messages are copies.
    state.messages.root = [msg('clone-1', 'source', 'source', 1, 1), ...(name === 'fork before' ? [] : [msg('clone-2', 'source', 'source', 2, 2)]), msg('fork-historical', 'fork-agent', 'fork-model', 3, 3)]
    state.messages['fork-child'] = [msg('child-own', 'child-agent', 'child-model', 4, 4)]
  }
  if (name === 'usage events') {
    const makeUsage = (id, seq, source, cost) => ({ id, created: seq, type: 'session.usage.recorded', durable: { aggregateID: 'root', seq, version: 1 }, data: { sessionID: 'root', source, cost, tokens: tokens(cost) } })
    state.logs.root = [makeUsage('title-usage', 1, 'title', 2), makeUsage('compaction-usage', 2, 'compaction', 3)]
    state.messages.root = [{ type: 'compaction', status: 'completed', id: 'compact', time: { created: 2 }, reason: 'auto', summary: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost: 3, tokens: tokens(3) }]
  }
  if (name === 'compaction history') {
    state.messages.root = [{ type: 'compaction', status: 'completed', id: 'compact', time: { created: 2 }, reason: 'auto', summary: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost: 3, tokens: tokens(3) }]
  }
  if (name === 'multi-call compaction') {
    const usage = (n) => ({ input: n, output: n, reasoning: 0, cache: { read: 0, write: 0 } })
    const event = (id, type, seq, data) => ({ id, created: seq, type, durable: { aggregateID: 'root', seq, version: 1 }, data: { sessionID: 'root', ...data } })
    state.logs.root = [
      event('compact-start', 'session.compaction.started', 1, { reason: 'auto', inputID: 'compact', recent: 'SECRET_RECENT_435' }),
      event('compact-call-1', 'session.usage.recorded', 2, { source: 'compaction', cost: 1, tokens: usage(1) }),
      event('compact-call-2', 'session.usage.recorded', 3, { source: 'compaction', cost: 2, tokens: usage(2) }),
      event('compact-end', 'session.compaction.ended', 4, { reason: 'auto', text: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost: 3, tokens: usage(3) }),
    ]
    state.messages.root = [{ type: 'compaction', status: 'completed', id: 'compact', time: { created: 1 }, reason: 'auto', summary: 'SECRET_SUMMARY_435', recent: 'SECRET_RECENT_435', cost: 3, tokens: usage(3) }]
  }
  const encode = (cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url')
  const decode = (cursor) => {
    try { return JSON.parse(Buffer.from(cursor, 'base64url').toString()) } catch { throw new Error('invalid cursor') }
  }
  const page = (items, query, limit) => {
    const i = query.offset
    const ordered = query.order === 'desc' ? [...items].reverse() : items
    return { data: ordered.slice(i, i + limit), cursor: {
      ...(i > 0 ? { previous: encode({ ...query, offset: Math.max(0, i - limit) }) } : {}),
      ...(i + limit < ordered.length ? { next: encode({ ...query, offset: i + limit }) } : {}),
    } }
  }
  const context = {
    ui: { router: { current: () => state.route } },
    data: {
      on(type, callback) {
        if (!state.listeners.has(type)) state.listeners.set(type, new Set())
        state.listeners.get(type).add(callback)
        return () => state.listeners.get(type).delete(callback)
      },
      listen(callback) { state.allListener = callback; return () => { state.allListener = undefined } },
    },
    client: {
      session: {
        async get({ sessionID }) { return state.sessions.find((s) => s.id === sessionID) },
        async list({ parentID, cursor, order, limit = 50 } = {}) {
          if (cursor !== undefined && order !== undefined) throw new Error('cursor cannot be combined with order')
          if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid limit')
          const query = cursor === undefined ? { kind: 'session', parentID, order: order ?? 'desc', offset: 0 } : decode(cursor)
          if (query.kind !== 'session' || (parentID !== undefined && parentID !== query.parentID)) throw new Error('cursor filter mismatch')
          state.calls.push(['session', query.parentID, cursor])
          if (state.failures.has(`session:${query.parentID}:${query.offset}`)) throw new Error('session list unavailable')
          return page(state.sessions.filter((s) => query.parentID === undefined || (query.parentID === null ? !s.parentID : s.parentID === query.parentID)), query, limit)
        },
        async *log({ sessionID }) {
          if (state.failures.has(`log:${sessionID}`)) throw new Error('log unavailable')
          yield* state.logs[sessionID] ?? []
          // The default V2 host does not persist durable events.
          yield { type: 'log.synced', aggregateID: sessionID }
        },
      },
      message: {
        async list({ sessionID, cursor, type, order, limit = 50 }) {
          if (cursor !== undefined && order !== undefined) throw new Error('cursor cannot be combined with order')
          if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('invalid limit')
          const query = cursor === undefined ? { kind: 'message', sessionID, type, order: order ?? 'desc', offset: 0 } : decode(cursor)
          if (query.kind !== 'message' || query.sessionID !== sessionID || query.type !== type) throw new Error('cursor filter mismatch')
          state.calls.push(['message', sessionID, cursor])
          const result = structuredClone(page((state.messages[sessionID] ?? []).filter((m) => !type || m.type === type), query, limit))
          if (state.gate && sessionID === 'root') { const gate = state.gate; state.gate = undefined; gate.entered(); await gate.promise }
          if (state.failures.has(`message:${sessionID}:${query.offset}`) || (query.offset > 0 && state.failures.has(`message:${sessionID}:later`))) throw new Error('history unavailable')
          return result
        },
      },
    },
  }
  state.emit = (event) => {
    if (event.type === 'session.usage.recorded') throw new Error('session.usage.recorded is not an OpenCode V2 live event')
    for (const callback of state.listeners.get(event.type) ?? []) callback(event)
    state.allListener?.({ details: event })
  }
  return { state, context }
}

export async function makeService(context) {
  const { createSessionDataAccess } = await import('../../src/session-data-access.js')
  return createSessionDataAccess(context)
}

export async function waitForSnapshot(service, predicate) {
  const deadline = Date.now() + 2000
  let snapshot
  do {
    snapshot = service.getSnapshot()
    if (snapshot && predicate(snapshot)) return snapshot
    await new Promise((resolve) => setTimeout(resolve, 10))
  } while (Date.now() < deadline)
  return snapshot
}

export function assertOutcome(snapshot, outcome) {
  assert.ok(snapshot && Array.isArray(snapshot.records), 'snapshot exposes records')
  const keys = snapshot.records.map((r) => `${r.sessionID}/${r.messageID}`).sort()
  const expected = {
    'tree with paginated history': ['child/child-1', 'child2/child2-1', 'grandchild/grand-1', 'root/root-1', 'root/root-2'],
    'recorded identities': ['root/root-1', 'root/root-2'],
    'missing and zero': ['root/missing', 'root/zero'],
    'partial failure': ['child/child-1', 'child2/child2-1', 'grandchild/grand-1', 'root/root-1', 'root/root-2'],
    recovered: ['child/child-1', 'child2/child2-1', 'grandchild/grand-1', 'root/root-1', 'root/root-2'],
    'live descendant': ['child/child-1', 'child2/child2-1', 'grandchild/grand-1', 'live-child/live-child-m', 'root/root-1', 'root/root-2'],
    'live settlement': ['root/live'], switched: ['new-root/new-m'], empty: [],
  }
  if (outcome === 'failed later page') {
    assert.deepEqual(keys.filter((key) => !key.startsWith('root/')), ['child/child-1', 'child2/child2-1', 'grandchild/grand-1'])
    const root = keys.filter((key) => key.startsWith('root/'))
    assert.ok(root.length > 0 && root.length < 203, 'the successfully loaded page must remain visible')
  } else assert.deepEqual(keys, expected[outcome], `wrong scope or duplicate records for ${outcome}`)
  assert.ok(snapshot.records.every((r) => typeof r.id === 'string' && r.id.length > 0), 'each record must expose its stable ID')
  assert.equal(new Set(snapshot.records.map((r) => r.id)).size, snapshot.records.length, 'record IDs must be distinct')
  if (outcome === 'empty') {
    assert.ok(snapshot.sessionID == null)
    assert.equal(snapshot.complete, true, 'an empty route has no session history to be incomplete')
    assert.deepEqual(snapshot.gaps, [])
    assert.deepEqual(snapshot.errors, [])
    return
  }
  assert.equal(snapshot.sessionID, outcome === 'switched' ? 'new-root' : 'root')
  // The fake host's log is not persisted: message projections cannot prove
  // that older retry attempts or title calls were captured.
  assert.equal(snapshot.complete, false, 'unrecoverable historical usage must not be reported complete')
  assert.ok(snapshot.gaps?.length > 0, 'incomplete data must have an explicit gap')
  if (outcome === 'partial failure' || outcome === 'failed later page') assert.ok(snapshot.errors?.length, 'load failure must be explicit')
  if (outcome === 'recorded identities' || outcome === 'tree with paginated history') {
    const first = snapshot.records.find((r) => r.messageID === 'root-1')
    const second = snapshot.records.find((r) => r.messageID === 'root-2')
    assert.equal(first.agent, 'alpha'); assert.deepEqual(first.model, model('old'))
    assert.equal(second.agent, 'beta'); assert.deepEqual(second.model, model('new'))
    assert.equal(first.cost, 1); assert.deepEqual(first.tokens, tokens(2))
  }
  if (outcome === 'missing and zero') {
    const zero = snapshot.records.find((r) => r.messageID === 'zero')
    const missing = snapshot.records.find((r) => r.messageID === 'missing')
    assert.equal(zero.cost, 0); assert.deepEqual(zero.tokens, tokens(0))
    assert.ok(missing.agent == null); assert.ok(missing.model == null); assert.ok(missing.cost == null); assert.ok(missing.tokens == null)
  }
  if (outcome === 'live settlement') {
    assert.equal(snapshot.records[0].cost, 7)
    assert.deepEqual(snapshot.records[0].tokens, tokens(12))
  }
}
