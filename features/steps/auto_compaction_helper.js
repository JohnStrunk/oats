// v2.0.32 compaction events are durable, with wall time and session sequence
// as distinct values. An automatic start has no inputID; its projected
// message ID is obtained from the start event, not the terminal event.
export const START_ID = 'evt_auto_compaction_start_001'
export const MESSAGE_ID = 'msg_auto_compaction_start_001'
export const END_ID = 'evt_auto_compaction_end_004'
export const CALL_ONE_ID = 'evt_compaction_call_002'
export const CALL_TWO_ID = 'evt_compaction_call_003'
export const OTHER_MESSAGE_ID = 'msg_prior_compaction_000'

export const callOneTokens = { input: 2, output: 4, reasoning: 0, cache: { read: 1, write: 0 } }
export const callTwoTokens = { input: 3, output: 6, reasoning: 0, cache: { read: 2, write: 0 } }
export const totalTokens = { input: 5, output: 10, reasoning: 0, cache: { read: 3, write: 0 } }

function event(id, type, seq, data) {
  return { id, type, created: 1700000000000 + seq * 10, durable: { aggregateID: 'root', seq, version: 1 }, data: { sessionID: 'root', ...data } }
}

export function compactionEvents() {
  return {
    start: event(START_ID, 'session.compaction.started', 21, { reason: 'auto', recent: 'recent context' }),
    callOne: event(CALL_ONE_ID, 'session.usage.recorded', 22, { source: 'compaction', cost: 0.5, tokens: callOneTokens }),
    callTwo: event(CALL_TWO_ID, 'session.usage.recorded', 23, { source: 'compaction', cost: 1.5, tokens: callTwoTokens }),
    end: event(END_ID, 'session.compaction.ended', 24, { reason: 'auto', text: 'summary', recent: 'recent context', cost: 2, tokens: totalTokens }),
  }
}

export function projectStart(host, event) {
  host.messages.root.push({
    id: MESSAGE_ID, type: 'compaction', status: 'running', reason: event.data.reason,
    summary: '', recent: event.data.recent, time: { created: event.created },
  })
  host.emit(event)
}

export function projectEnd(host, event) {
  const running = host.messages.root.findLast((m) => m.type === 'compaction' && m.status === 'running')
  if (!running) throw new Error('missing running compaction projection')
  Object.assign(running, { status: 'completed', reason: event.data.reason, summary: event.data.text, recent: event.data.recent, cost: event.data.cost, tokens: event.data.tokens })
  host.emit(event)
}
