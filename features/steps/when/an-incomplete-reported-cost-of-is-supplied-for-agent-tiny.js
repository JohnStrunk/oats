import { When } from '@cucumber/cucumber'
import { updateControl } from '../sidebar_scenario_helper.js'

When('an incomplete reported cost of {string} is supplied for agent tiny', async function (value) {
  const cost = Number(value)
  if (!Number.isFinite(cost)) throw new Error(`invalid reported cost: ${value}`)
  await updateControl(this, fixture => {
    const template = fixture.messages[fixture.rootSession].find(record => record.agent === 'tiny')
    if (!template) throw new Error('missing tiny-agent fixture record')
    const unknown = { ...template, id: 'tiny-unknown-limit' }
    delete unknown.cost
    fixture.messages[fixture.rootSession] = [
      { ...template, id: 'tiny-known-limit', cost },
      unknown,
    ]
    fixture.events.push({ id: `refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
})
