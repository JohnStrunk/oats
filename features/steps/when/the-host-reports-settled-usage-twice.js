import { When } from '@cucumber/cucumber'
When('the host reports settled usage twice', async function () {
  await this.service.refresh()
  const record = this.host.messages.root[0]
  this.host.emit({ id: 'start-1', created: 1, type: 'session.step.started', durable: { aggregateID: 'root', seq: 1, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'live', agent: 'alpha', model: { providerID: 'provider', id: 'old' }, started: 1 } })
  record.cost = 7
  record.tokens = { input: 12, output: 13, reasoning: 0, cache: { read: 0, write: 0 } }
  record.time.completed = 2
  const event = { id: 'event-1', created: 2, type: 'session.step.ended', durable: { aggregateID: 'root', seq: 2, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'live', finish: 'stop', cost: record.cost, tokens: record.tokens } }
  this.host.emit(event); this.host.emit(event)
})
