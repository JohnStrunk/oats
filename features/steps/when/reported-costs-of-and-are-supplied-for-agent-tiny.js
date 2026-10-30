import { When } from '@cucumber/cucumber'
import { updateControl } from '../sidebar_scenario_helper.js'

When('reported costs of {string} and {string} are supplied for agent tiny', async function (first, second) {
  const costs = [first, second].map(Number)
  if (!costs.every(Number.isFinite)) throw new Error('reported costs must be finite')
  await updateControl(this, fixture => {
    const template = fixture.messages[fixture.rootSession].find(record => record.agent === 'tiny')
    if (!template) throw new Error('missing tiny-agent fixture record')
    fixture.messages[fixture.rootSession] = costs.map((cost, index) => ({
      ...template, id: `tiny-sum-${index}`, cost,
    }))
    fixture.events.push({ id: `refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
})
