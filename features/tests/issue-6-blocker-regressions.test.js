import assert from 'node:assert/strict'
import test from 'node:test'
import plugin from '../../src/tui.js'
import { agentStatsLines } from '../../src/agent-stats.js'
import { createSessionDataAccess } from '../../src/session-data-access.js'
import { hostFixture, waitForSnapshot } from '../steps/session_data_helper.js'
import { costRows, rowFor } from './agent-stats-display-oracle.js'

const snapshot = (records = [], options = {}) => ({
  sessionID: 'root', records, complete: true, gaps: [], errors: [], ...options,
})
const record = (agent, cost) => ({ agent, cost })

test('disposing from the loading notification starts no host reads', async () => {
  const { context } = hostFixture('recorded identities')
  let reads = 0
  const get = context.client.session.get
  context.client.session.get = (...args) => { reads++; return get(...args) }
  const service = createSessionDataAccess(context)
  service.subscribe(() => service.dispose())
  await service.refresh()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(reads, 0)
  assert.equal(service.getSnapshot().sessionID, null)
})

test('a refresh during the loading notification supersedes the outer refresh without untracked reads', async () => {
  const { context } = hostFixture('recorded identities')
  let reads = 0
  const get = context.client.session.get
  context.client.session.get = (...args) => { reads++; return get(...args) }
  const service = createSessionDataAccess(context)
  let nested
  let entered = false
  service.subscribe(() => {
    if (!entered) {
      entered = true
      nested = service.refresh()
    }
  })
  try {
    const outer = service.refresh()
    await Promise.all([outer, nested])
    assert.equal(reads, 1)
    assert.equal(service.getSnapshot().sessionID, 'root')
    assert.equal(service.getSnapshot().records.length, 2)
  } finally { service.dispose() }
})

test('a structure event during notification coalesces with the published in-flight refresh', async () => {
  const { context, state } = hostFixture('recorded identities')
  let reads = 0
  const get = context.client.session.get
  context.client.session.get = (...args) => { reads++; return get(...args) }
  const service = createSessionDataAccess(context)
  let fired = false
  service.subscribe(() => {
    if (!fired) {
      fired = true
      state.emit({ type: 'session.created', data: { parentID: 'root' } })
    }
  })
  try {
    await service.refresh()
    await waitForSnapshot(service, () => reads === 2)
    assert.equal(reads, 2, 'one initial and one coalesced follow-up read')
  } finally { service.dispose() }
})

test('an abort handler can reenter refresh without reviving the superseded traversal', async () => {
  const { context } = hostFixture('recorded identities')
  const get = context.client.session.get
  let reads = 0
  let nested
  let entered
  const started = new Promise(resolve => { entered = resolve })
  let service
  context.client.session.get = (input, options) => {
    reads++
    if (reads === 1) {
      options.signal.addEventListener('abort', () => { nested = service.refresh() }, { once: true })
      entered()
      return new Promise(() => {})
    }
    return get(input, options)
  }
  service = createSessionDataAccess(context)
  try {
    const first = service.refresh()
    await started
    const second = service.refresh()
    await Promise.all([first, second, nested])
    assert.equal(reads, 2, 'the outer superseded refresh must not start a host read')
    assert.equal(service.getSnapshot().sessionID, 'root')
    assert.equal(service.getSnapshot().records.length, 2)
  } finally { service.dispose() }
})

test('disposing from an abort handler prevents the replacement host read', async () => {
  const { context } = hostFixture('recorded identities')
  let reads = 0
  let entered
  const started = new Promise(resolve => { entered = resolve })
  let service
  context.client.session.get = (_input, options) => {
    reads++
    options.signal.addEventListener('abort', () => service.dispose(), { once: true })
    entered()
    return new Promise(() => {})
  }
  service = createSessionDataAccess(context)
  const first = service.refresh()
  await started
  const second = service.refresh()
  await Promise.all([first, second])
  assert.equal(reads, 1)
  assert.equal(service.getSnapshot().sessionID, null)
})

test('empty snapshots distinguish benign gaps from withheld history', () => {
  for (const gap of ['historical-usage-unavailable', 'retry-history-unavailable']) {
    const lines = agentStatsLines(snapshot([], { complete: false, gaps: [{ kind: gap }] }), 'root')
    assert.ok(lines.includes('Summary incomplete'))
    assert.ok(lines.includes('No agent usage recorded'))
  }
  const withheld = agentStatsLines(snapshot([], { complete: false, gaps: [{ kind: 'fork-history-unavailable' }] }), 'root')
  assert.ok(withheld.includes('Session history unavailable'))
  assert.ok(agentStatsLines(snapshot(), 'root').includes('No agent usage recorded'))
  const partial = agentStatsLines(snapshot([record('alpha', 2)], { complete: false, gaps: [{ kind: 'historical-usage-unavailable' }] }), 'root')
  assert.equal(rowFor(partial, 'alpha').value, '$2.00')
  assert.ok(partial.includes('Summary incomplete'))
})

test('sanitized, truncated and reserved names remain visibly distinct', () => {
  const records = [
    record('alpha\x01', 1), record('alpha\x02', 2),
    record('abcdefghijklmnop-FIRST', 3), record('abcdefghijklmnop-SECOND', 4),
    record('alpha� #1', 5), record('Unattributed', 6), record(null, 7),
    record('alpha\x01', 8),
  ]
  const lines = agentStatsLines(snapshot(records), 'root')
  const rows = costRows(lines)
  const labels = rows.map((row) => row.label)
  assert.equal(labels.length, 7)
  assert.equal(new Set(labels).size, 7)
  assert.ok(labels.every((label) => Array.from(label).length <= 16))
  assert.ok(rows.some((row) => row.value === '$9.00'))
  assert.equal(rowFor(lines, 'Unattributed').value, '$7.00')
  assert.ok(rows.some((row) => row.label.startsWith('Unattributed') && row.label !== 'Unattributed' && row.value === '$6.00'))
  assert.deepEqual(
    [...labels].sort(),
    costRows(agentStatsLines(snapshot([...records].reverse()), 'root')).map((row) => row.label).sort(),
  )
})

test('keyboard toggle is available in the command palette without a default binding', () => {
  const { context } = hostFixture('recorded identities')
  context.ui.toast = { show() {} }
  context.ui.slot = () => () => {}
  let layer
  context.keymap = { layer: factory => { layer = factory() } }
  const dispose = plugin.setup(context)
  try {
    const command = layer.commands.find(item => item.id === 'oats.agent-stats.toggle')
    assert.equal(command.bind, false)
    assert.equal(command.palette, true)
  } finally { dispose() }
})
