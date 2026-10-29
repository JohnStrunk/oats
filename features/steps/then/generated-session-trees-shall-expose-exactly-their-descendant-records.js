import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { hostFixture, makeService } from '../session_data_helper.js'

Then('generated session trees shall expose exactly their descendant records', { timeout: 30000 }, async function () {
  await fc.assert(fc.asyncProperty(fc.array(fc.nat(), { minLength: 1, maxLength: 14 }), async (parents) => {
    const { state, context } = hostFixture('generated')
    const template = state.sessions.find((s) => s.id === 'root')
    const session = (id, parentID) => ({ ...template, id, ...(parentID ? { parentID } : { parentID: undefined }) })
    state.sessions = [session('ancestor'), session('root', 'ancestor'), session('unrelated', 'ancestor')]
    state.messages = { ancestor: [], unrelated: [{ id: 'outside', type: 'assistant', agent: 'outside', model: { providerID: 'p', id: 'm' }, cost: 1, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, content: [], time: { created: 1, completed: 2 } }] }
    const nodes = ['root']
    for (const [index, value] of parents.entries()) {
      const id = `node-${index}`
      state.sessions.push(session(id, nodes[value % nodes.length]))
      nodes.push(id)
    }
    for (const id of nodes) state.messages[id] = [{ id: `msg-${id}`, type: 'assistant', agent: 'worker', model: { providerID: 'p', id: 'm' }, cost: 1, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, content: [], time: { created: 1, completed: 2 } }]
    const service = await makeService(context)
    try {
      await service.refresh()
      assert.deepEqual(service.getSnapshot().records.map((r) => r.sessionID).sort(), [...nodes].sort())
    } finally { service.dispose?.() }
  }), { numRuns: 30 })
})
