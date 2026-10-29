import { When } from '@cucumber/cucumber'
import { waitForSnapshot } from '../session_data_helper.js'
When('a new live attempt settles in the fork', async function () {
  await this.service.refresh()
  const model = { providerID: 'provider', id: 'new-model' }
  const tokens = { input: 5, output: 6, reasoning: 0, cache: { read: 0, write: 0 } }
  this.host.messages.root.push({ id: 'fork-live', type: 'assistant', agent: 'new-agent', model, time: { created: 10, completed: 11 }, content: [], cost: 5, tokens })
  this.host.emit({ id: 'fork-start', type: 'session.step.started', created: 10, durable: { aggregateID: 'root', seq: 10, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'fork-live', agent: 'new-agent', model, started: 10 } })
  this.host.emit({ id: 'fork-end', type: 'session.step.ended', created: 11, durable: { aggregateID: 'root', seq: 11, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'fork-live', finish: 'stop', cost: 5, tokens } })
  await waitForSnapshot(this.service, (s) => s.records.some((r) => r.messageID === 'fork-live'))
  await this.service.refresh()
})
