import { When } from '@cucumber/cucumber'
import { emitStart, model, usage } from '../settlement_boundary_helper.js'

When('a retry starts after known historical usage', async function () {
  const h = this.regressionHost
  h.messages.root = [{
    id: 'retry-missing', type: 'assistant', agent: 'first-agent', model: model('first-model'), content: [],
    time: { created: 1700000000100, completed: 1700000000200 }, finish: 'stop', cost: 3, tokens: usage(11),
  }]
  await h.service.refresh()
  emitStart(h, 'root', 'retry-missing', 51, 1700000000300, 'retry-agent', 'retry-model')
})
