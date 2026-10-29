import { When } from '@cucumber/cucumber'
When('the host reports a new descendant session', async function () {
  await this.service.refresh()
  const child = { id: 'live-child', parentID: 'child', projectID: 'project', time: { created: 1, updated: 1 }, location: { directory: '/workspace' }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }
  this.host.sessions.push(child)
  this.host.messages['live-child'] = [{ id: 'live-child-m', type: 'assistant', agent: 'worker', model: { providerID: 'provider', id: 'model' }, time: { created: 1, completed: 2 }, content: [], cost: 1, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } }]
  this.host.emit({ id: 'session-created', created: 2, type: 'session.created', durable: { aggregateID: 'live-child', seq: 1, version: 1 }, data: { sessionID: 'live-child', parentID: 'child', projectID: 'project', location: { directory: '/workspace' }, slug: 'live-child', version: '2.0.32' } })
})
