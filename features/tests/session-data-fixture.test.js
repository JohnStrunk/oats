import test from 'node:test'
import assert from 'node:assert/strict'
import { hostFixture } from '../steps/session_data_helper.js'

test('message fixture preserves order and filter across opaque cursors', async () => {
  const { context } = hostFixture('recorded identities')
  const first = await context.client.message.list({ sessionID: 'root', type: 'assistant', order: 'desc', limit: 1 })
  assert.deepEqual(first.data.map((m) => m.id), ['root-2'])
  assert.ok(first.cursor.next)
  await assert.rejects(context.client.message.list({ sessionID: 'root', type: 'assistant', order: 'desc', cursor: first.cursor.next, limit: 1 }))
  await assert.rejects(context.client.message.list({ sessionID: 'root', cursor: first.cursor.next, limit: 1 }))
  const second = await context.client.message.list({ sessionID: 'root', type: 'assistant', cursor: first.cursor.next, limit: 1 })
  assert.deepEqual(second.data.map((m) => m.id), ['root-1'])
  assert.equal(second.cursor.next, undefined)
})

test('session fixture retains parent filter across opaque cursors', async () => {
  const { context } = hostFixture('tree with paginated history')
  const first = await context.client.session.list({ parentID: 'root', order: 'asc', limit: 1 })
  assert.deepEqual(first.data.map((s) => s.id), ['child'])
  await assert.rejects(context.client.session.list({ parentID: 'root', order: 'asc', cursor: first.cursor.next, limit: 1 }))
  const second = await context.client.session.list({ cursor: first.cursor.next, limit: 1 })
  assert.deepEqual(second.data.map((s) => s.id), ['child2'])
})

test('the default historical log may contain only log.synced', async () => {
  const { context } = hostFixture('recorded identities')
  const events = []
  for await (const event of context.client.session.log({ sessionID: 'root', follow: false })) events.push(event)
  assert.deepEqual(events, [{ type: 'log.synced', aggregateID: 'root' }])
})

test('the live fake does not broadcast log-only usage records', () => {
  const { state, context } = hostFixture('recorded identities')
  let delivered = false
  context.data.listen(() => { delivered = true })
  assert.throws(() => state.emit({ type: 'session.usage.recorded' }), /not an OpenCode V2 live event/)
  assert.equal(delivered, false)
  state.emit({ type: 'session.usage.updated', data: { sessionID: 'root', cost: 5, tokens: {} } })
  assert.equal(delivered, true)
})
