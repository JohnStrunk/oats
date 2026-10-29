import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionDataAccess } from '../../src/session-data-access.js'

// Regression guard for issue #4. The commit used to rescan every retained
// record for every session, which is O(sessions * records). Wall-clock limits
// are noisy in CI, so this probe counts record-map traversals instead.
// Doubling the session count while holding records per session constant
// doubles the work for a linear commit and roughly quadruples it for a
// per-session rescan, independent of timing.
const tokens = (n) => ({
  input: n,
  output: n,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})

const model = { providerID: 'provider', id: 'model' }

function historyRecord(sessionID, index) {
  return {
    id: `${sessionID}-${index}`,
    type: 'assistant',
    agent: `agent-${sessionID}`,
    model,
    cost: index + 1,
    tokens: tokens(index + 1),
    time: { created: index + 1, completed: index + 1 },
    content: [],
  }
}

function recordsFor(sessionID, count) {
  return Array.from({ length: count }, (_, index) =>
    historyRecord(sessionID, index),
  )
}

function syntheticHost(sessionCount, recordsPerSession) {
  const sessions = [
    { id: 'root', agent: 'root-agent', model, projectID: 'project' },
  ]
  const messages = new Map([['root', recordsFor('root', recordsPerSession)]])
  for (let i = 1; i < sessionCount; i += 1) {
    const sessionID = `child-${i}`
    sessions.push({
      id: sessionID,
      parentID: 'root',
      agent: `agent-${sessionID}`,
      model,
      projectID: 'project',
    })
    messages.set(sessionID, recordsFor(sessionID, recordsPerSession))
  }

  return {
    ui: { router: { current: () => ({ type: 'session', sessionID: 'root' }) } },
    data: {
      on: () => () => {},
      listen: () => () => {},
    },
    client: {
      session: {
        async get({ sessionID }) {
          return sessions.find((session) => session.id === sessionID)
        },
        async list({ parentID, cursor, order } = {}) {
          if (cursor !== undefined && order !== undefined) {
            throw new Error('cursor cannot be combined with order')
          }
          const children = sessions.filter(
            (session) => session.parentID === parentID,
          )
          return {
            data: order === 'desc' ? [...children].reverse() : children,
            cursor: {},
          }
        },
        async *log({ sessionID }) {
          yield { type: 'log.synced', aggregateID: sessionID }
        },
      },
      message: {
        async list({ sessionID, cursor, order } = {}) {
          if (cursor !== undefined && order !== undefined) {
            throw new Error('cursor cannot be combined with order')
          }
          const records = messages.get(sessionID) ?? []
          return {
            data: order === 'desc' ? [...records].reverse() : records,
            cursor: {},
          }
        },
      },
    },
  }
}

const isRecord = (value) =>
  value != null &&
  typeof value === 'object' &&
  (value.source === 'assistant' || value.source === 'compaction') &&
  typeof value.sessionID === 'string' &&
  typeof value.messageID === 'string'

// Count entries of record-like Maps, including forEach callbacks. Map traversal
// is what the quadratic commit scan used; a linear commit traverses each record
// a small constant number of times. shortcut: probe record-Map traversal only,
// replace with an equivalent counter if record storage moves away from Map.
function countRecordMapTraversal() {
  const originals = {
    entries: Map.prototype.entries,
    values: Map.prototype.values,
    iterator: Map.prototype[Symbol.iterator],
    forEach: Map.prototype.forEach,
  }
  let count = 0
  const wrap = (original, pick) =>
    function (...args) {
      const iterator = original.apply(this, args)
      return {
        next() {
          const step = iterator.next()
          if (!step.done && isRecord(pick(step.value))) count += 1
          return step
        },
        return(value) {
          return typeof iterator.return === 'function'
            ? iterator.return(value)
            : { done: true, value }
        },
        throw(error) {
          if (typeof iterator.throw !== 'function') throw error
          return iterator.throw(error)
        },
        [Symbol.iterator]() {
          return this
        },
      }
    }

  Map.prototype.entries = wrap(originals.entries, (entry) => entry[1])
  Map.prototype.values = wrap(originals.values, (value) => value)
  Map.prototype[Symbol.iterator] = wrap(originals.iterator, (entry) => entry[1])
  Map.prototype.forEach = function (callback, thisArg) {
    if (typeof callback !== 'function') {
      return originals.forEach.call(this, callback, thisArg)
    }
    return originals.forEach.call(
      this,
      (value, key, map) => {
        if (isRecord(value)) count += 1
        return callback.call(thisArg, value, key, map)
      },
      thisArg,
    )
  }

  return {
    stop() {
      Map.prototype.entries = originals.entries
      Map.prototype.values = originals.values
      Map.prototype[Symbol.iterator] = originals.iterator
      Map.prototype.forEach = originals.forEach
      return count
    },
  }
}

async function measureCommit(sessionCount, recordsPerSession) {
  const context = syntheticHost(sessionCount, recordsPerSession)
  const service = createSessionDataAccess(context)
  // Populate retained history first. The regression being guarded against is
  // a commit that rescans that retained history once per session.
  await service.refresh()
  const probe = countRecordMapTraversal()
  let traversals
  try {
    await service.refresh()
    traversals = probe.stop()
  } finally {
    if (traversals === undefined) probe.stop()
  }
  const snapshot = service.getSnapshot()
  service.dispose()
  return { traversals, snapshot, totalRecords: sessionCount * recordsPerSession }
}

test('commit record traversal grows linearly with the session count', async () => {
  const small = await measureCommit(16, 8)
  const large = await measureCommit(32, 8)

  for (const measurement of [small, large]) {
    assert.equal(measurement.snapshot.sessionID, 'root')
    assert.equal(measurement.snapshot.records.length, measurement.totalRecords)
    assert.equal(
      new Set(measurement.snapshot.records.map((record) => record.id)).size,
      measurement.totalRecords,
    )
    assert.ok(
      measurement.traversals > 0,
      'the commit probe observed no record-map traversal; update the probe for the new record representation instead of skipping the invariant',
    )
  }

  assert.ok(
    large.traversals <= small.traversals * 3,
    `record traversal grew from ${small.traversals} to ${large.traversals} when the session count doubled`,
  )
})
