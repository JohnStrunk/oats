import { When } from '@cucumber/cucumber'
import { model, modal, updateControl, usage } from '../usage_details_helper.js'

When('additional usage settles for the details pair', async function () {
  await modal(this)
  await updateControl(this, fixture => {
    const common = { sessionID: fixture.rootSession, assistantMessageID: 'details-live' }
    fixture.events.push(
      { id: 'details-start', type: 'session.step.started', created: 10, data: { ...common, agent: 'alpha', model } },
      { id: 'details-end', type: 'session.step.ended', created: 11, data: { ...common, cost: 4, tokens: usage, finish: 'stop' } },
    )
  })
})
