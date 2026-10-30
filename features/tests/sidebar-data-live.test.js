import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDataAccess } from '../../src/session-data-access.js'
import { aggregateReportedCosts } from '../../src/usage-aggregation.js'
import {
  assistantMessage,
  makeSidebarHost,
  sessionInfo,
  waitForSnapshot,
} from './sidebar-test-host.js'

const totals = (snapshot) =>
  Object.fromEntries(
    aggregateReportedCosts(snapshot).agents.map((entry) => [
      entry.agent,
      entry.knownCost,
    ]),
  )

test('history is exposed when the session opens and subscribers are notified', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  let notifications = 0
  const unsubscribe = sessionData.subscribe(() => {
    notifications += 1
  })

  try {
    const snapshot = await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )

    assert.deepEqual(totals(snapshot), { alpha: 1 })
    assert.ok(notifications > 0, 'loading and commit must notify the UI')
  } finally {
    unsubscribe()
    sessionData.dispose()
  }
})

test('a settled live step updates the displayed total and notifies the UI', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  let notifications = 0
  const unsubscribe = sessionData.subscribe(() => {
    notifications += 1
  })

  try {
    await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )
    const before = notifications

    host.settleStep({ messageID: 'live-step', agent: 'alpha', cost: 4 })
    const snapshot = await waitForSnapshot(
      sessionData,
      (current) =>
        current.sessionID === 'root' &&
        aggregateReportedCosts(current).agents.some(
          (entry) => entry.agent === 'alpha' && entry.knownCost === 5,
        ),
    )

    assert.deepEqual(totals(snapshot), { alpha: 5 })
    assert.ok(notifications > before, 'a live settlement must notify the UI')
  } finally {
    unsubscribe()
    sessionData.dispose()
  }
})

test('live usage for a session outside the displayed scope is not presented', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
      other: [assistantMessage('other-message', { agent: 'other', cost: 9 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)

  try {
    await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )

    host.settleStep({ sessionID: 'other', messageID: 'other-live', agent: 'other', cost: 9 })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const snapshot = sessionData.getSnapshot()
    assert.deepEqual(totals(snapshot), { alpha: 1 })
    assert.ok(
      !snapshot.records.some((record) => record.sessionID === 'other'),
      'out-of-scope settlements must not leak into the displayed snapshot',
    )
  } finally {
    sessionData.dispose()
  }
})

test('switching the displayed session hides the previous totals while the new history loads', async () => {
  const host = makeSidebarHost({
    sessions: [sessionInfo('root'), sessionInfo('new-root')],
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
      'new-root': [assistantMessage('new-message', { agent: 'new-agent', cost: 5 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  const blocked = host.blockHistory('new-root')

  try {
    await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )

    host.setRoute({ type: 'session', sessionID: 'new-root' })
    host.emit({ type: 'session.viewed', data: { sessionID: 'new-root' } })
    await blocked.entered
    const loading = await waitForSnapshot(
      sessionData,
      (current) =>
        current.sessionID == null &&
        current.gaps.some((gap) => gap.kind === 'session-load-in-progress'),
    )

    assert.equal(loading.sessionID, null)
    assert.deepEqual(loading.records, [], 'the previous session subtree must not remain visible')
    assert.ok(!('alpha' in totals(loading)))

    blocked.release()
    const switched = await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'new-root' && current.records.length === 1,
    )

    assert.deepEqual(totals(switched), { 'new-agent': 5 })
    assert.ok(!('alpha' in totals(switched)), 'the previous session total must not linger')
  } finally {
    sessionData.dispose()
  }
})

test('a stale response from the previously displayed session cannot replace the new session', async () => {
  const host = makeSidebarHost({
    sessions: [sessionInfo('root'), sessionInfo('new-root')],
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
      'new-root': [assistantMessage('new-message', { agent: 'new-agent', cost: 5 })],
    },
  })
  const blockedRoot = host.blockHistory('root')
  const sessionData = createSessionDataAccess(host.context)

  try {
    await blockedRoot.entered
    assert.ok(
      sessionData.getSnapshot().gaps.some(
        (gap) => gap.kind === 'session-load-in-progress',
      ),
    )

    host.setRoute({ type: 'session', sessionID: 'new-root' })
    host.emit({ type: 'session.viewed', data: { sessionID: 'new-root' } })
    const switched = await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'new-root' && current.records.length === 1,
    )
    assert.deepEqual(totals(switched), { 'new-agent': 5 })

    blockedRoot.release()
    await new Promise((resolve) => setTimeout(resolve, 20))

    const finalSnapshot = sessionData.getSnapshot()
    assert.equal(finalSnapshot.sessionID, 'new-root')
    assert.deepEqual(totals(finalSnapshot), { 'new-agent': 5 })
    assert.ok(!('alpha' in totals(finalSnapshot)))
  } finally {
    sessionData.dispose()
  }
})

test('unsubscribing stops notifications without disturbing data access', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  let notifications = 0
  const unsubscribe = sessionData.subscribe(() => {
    notifications += 1
  })

  try {
    await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )
    unsubscribe()
    const afterUnsubscribe = notifications

    host.settleStep({ messageID: 'live-after-unsubscribe', agent: 'alpha', cost: 2 })
    const snapshot = await waitForSnapshot(
      sessionData,
      (current) =>
        aggregateReportedCosts(current).agents.some(
          (entry) => entry.agent === 'alpha' && entry.knownCost === 3,
        ),
    )

    assert.equal(notifications, afterUnsubscribe)
    assert.deepEqual(totals(snapshot), { alpha: 3 })
  } finally {
    sessionData.dispose()
  }
})

test('disposal detaches every host listener and publishes no later updates', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  let notifications = 0
  sessionData.subscribe(() => {
    notifications += 1
  })

  await waitForSnapshot(
    sessionData,
    (current) => current.sessionID === 'root' && current.records.length === 1,
  )
  const beforeDispose = notifications
  sessionData.dispose()

  assert.equal(host.listenerCount('session.step.ended'), 0)
  assert.equal(host.listenerCount('session.step.started'), 0)
  assert.equal(host.allListenerCount(), 0)

  host.settleStep({ messageID: 'after-dispose', agent: 'alpha', cost: 9 })
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.equal(notifications, beforeDispose)
  assert.deepEqual(sessionData.getSnapshot().records, [])
  assert.equal(sessionData.getSnapshot().sessionID, null)
})

test('disposal during a blocked history read publishes no data after release', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const blocked = host.blockHistory('root')
  const sessionData = createSessionDataAccess(host.context)

  await blocked.entered
  sessionData.dispose()
  blocked.release()
  await new Promise((resolve) => setTimeout(resolve, 20))

  const snapshot = sessionData.getSnapshot()
  assert.equal(snapshot.sessionID, null)
  assert.deepEqual(snapshot.records, [])
  assert.equal(host.allListenerCount(), 0)
})

test('repeated subscriptions are independent and idempotent on cleanup', async () => {
  const host = makeSidebarHost({
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
    },
  })
  const sessionData = createSessionDataAccess(host.context)
  const calls = []
  const first = sessionData.subscribe(() => calls.push('first'))
  const second = sessionData.subscribe(() => calls.push('second'))

  try {
    await waitForSnapshot(
      sessionData,
      (current) => current.sessionID === 'root' && current.records.length === 1,
    )
    // The startup route effect can schedule one trailing refresh. Let it
    // settle before observing only the live notification.
    await new Promise((resolve) => setTimeout(resolve, 30))
    first()
    first()
    calls.length = 0

    host.settleStep({ messageID: 'live-independent', agent: 'alpha', cost: 2 })
    await waitForSnapshot(
      sessionData,
      (current) =>
        aggregateReportedCosts(current).agents.some(
          (entry) => entry.agent === 'alpha' && entry.knownCost === 3,
        ),
    )

    assert.ok(calls.length >= 1, 'the remaining subscriber must still be notified')
    assert.deepEqual(new Set(calls), new Set(['second']))
    assert.ok(!calls.includes('first'))
  } finally {
    second()
    sessionData.dispose()
  }
})
