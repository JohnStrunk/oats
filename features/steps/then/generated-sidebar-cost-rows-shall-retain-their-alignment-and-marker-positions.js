import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { eventually, updateControl } from '../sidebar_scenario_helper.js'
import { inspectAlignment, legendCount } from '../sidebar_alignment_helper.js'

Then('generated sidebar cost rows shall retain their alignment and marker positions', { timeout: 180000 }, async function () {
  let generation = 0
  await fc.assert(fc.asyncProperty(
    fc.integer({ min: 1, max: 12 }), fc.integer({ min: -999999, max: 999999 }),
    fc.boolean(), fc.boolean(), fc.boolean(),
    async (length, cents, incomplete, unavailable, unknownUnattributed) => {
      const label = `a${'b'.repeat(length)}`
      const id = generation++
      const value = cents < 0
        ? `$-${Math.floor(-cents / 100)}.${String(-cents % 100).padStart(2, '0')}`
        : `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
      const expected = [
        { label, value: unavailable ? 'unavailable' : value, marker: !unavailable && incomplete ? 'e' : 'blank' },
        { label: 'zero', value: '$0.00', marker: 'blank' },
        { label: 'Unattributed', value: unknownUnattributed ? 'unavailable' : '$12.34', marker: 'blank' },
      ]
      await updateControl(this, fixture => {
        const template = fixture.messages[fixture.rootSession][0]
        const record = (suffix, agent, cost) => {
          const entry = { ...template, id: `layout-${id}-${suffix}` }
          if (agent === null) delete entry.agent
          else entry.agent = agent
          if (cost === null) delete entry.cost
          else entry.cost = cost
          return entry
        }
        fixture.messages[fixture.rootSession] = [
          record('subject', label, unavailable ? null : cents / 100),
          ...(incomplete && !unavailable ? [record('missing', label, null)] : []),
          record('zero', 'zero', 0), record('unattributed', null, unknownUnattributed ? null : 12.34),
        ]
        fixture.events.push({ id: `layout-refresh-${id}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
      })
      await eventually(this, text => inspectAlignment(text, expected) && legendCount(text) === (incomplete && !unavailable ? 1 : 0),
        `generated rows for ${label}, ${cents} cents and incomplete=${incomplete} must align`)
    },
  ), { seed: 340034, numRuns: 20, endOnFailure: true })
})
