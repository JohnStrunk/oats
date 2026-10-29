import { When } from '@cucumber/cucumber'
import { waitForSnapshot } from '../session_data_helper.js'
When('a failed step and a retry settle for the same assistant message', async function () {
  await this.service.refresh()
  const event = (id, type, seq, data) => ({ id, created: seq, type, durable: { aggregateID: 'root', seq, version: 1 }, data: { sessionID: 'root', assistantMessageID: 'retry', ...data } })
  const usage = (n) => ({ input: n, output: n + 1, reasoning: 0, cache: { read: 0, write: 0 } })
  const message = { id: 'retry', type: 'assistant', agent: 'alpha', model: { providerID: 'provider', id: 'old' }, content: [], time: { created: 1 } }
  this.host.messages.root.push(message)
  this.host.emit(event('start-1', 'session.step.started', 1, { agent: 'alpha', model: message.model, started: 1 }))
  Object.assign(message, { cost: 1, tokens: usage(1), time: { created: 1, completed: 2 } })
  this.host.emit(event('failed-1', 'session.step.failed', 2, { error: { type: 'provider', message: 'failed' }, cost: 1, tokens: usage(1) }))
  this.host.emit(event('start-2', 'session.step.started', 3, { agent: 'alpha', model: message.model, started: 3 }))
  Object.assign(message, { cost: 2, tokens: usage(2), time: { created: 3, completed: 4 } })
  const ended = event('ended-2', 'session.step.ended', 4, { finish: 'stop', cost: 2, tokens: usage(2) })
  this.host.emit(ended)
  this.host.emit(ended)
  await waitForSnapshot(this.service, (s) => s.records.filter((r) => r.messageID === 'retry').length === 2)
  await this.service.refresh()
})
