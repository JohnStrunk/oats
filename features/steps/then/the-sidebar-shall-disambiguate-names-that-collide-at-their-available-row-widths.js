import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { eventually, updateControl } from '../sidebar_scenario_helper.js'
import { inspectAgentNameCollisions } from '../sidebar_alignment_helper.js'

const suffix = fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 8 })
  .map(characters => characters.join(''))

async function showCollisionRows(world, expected, generation) {
  await updateControl(world, fixture => {
    const template = fixture.messages[fixture.rootSession][0]
    fixture.messages[fixture.rootSession] = expected.map((item, index) => ({
      ...template,
      id: `name-collision-${generation}-${index}`,
      agent: item.name,
      cost: Number(item.value.slice(1)),
    }))
    fixture.events.push({ id: `name-collision-refresh-${generation}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
  await eventually(world, text => inspectAgentNameCollisions(text, expected),
    `names that collide after fitting their own rows must remain separate: ${expected.map(item => item.value).join(', ')}`)
}

Then('the sidebar shall disambiguate names that collide at their available row widths:', { timeout: 180000 }, async function (table) {
  const expected = table.hashes()
  if (expected.length < 2) throw new Error('at least two colliding names are required')
  if (expected.some(item => !/^\$\d+\.\d{2}$/.test(item.value))) throw new Error('collision rows require distinct exact cost values')
  if (expected.some(item => !['blank', 'e'].includes(item.marker))) throw new Error('invalid expected marker')
  if (new Set(expected.map(item => item.name)).size !== expected.length) throw new Error('recorded names must be distinct')
  if (new Set(expected.map(item => item.value)).size !== expected.length) throw new Error('collision rows require distinct values')

  await showCollisionRows(this, expected, 0)

  let generation = 1
  await fc.assert(fc.asyncProperty(
    fc.tuple(
      fc.integer({ min: 180, max: 220 }),
      suffix,
      suffix,
    ).filter(([, first, second]) => first !== second),
    async ([prefixLength, firstSuffix, secondSuffix]) => {
      const prefix = `generated-shared-${'x'.repeat(prefixLength)}`
      const pair = [
        { name: `${prefix}-${firstSuffix}`, value: '$8.00', marker: 'blank' },
        { name: `${prefix}-${secondSuffix}`, value: '$9.00', marker: 'blank' },
      ]
      await showCollisionRows(this, pair, generation++)
    },
  ), { seed: 470049, numRuns: 4, endOnFailure: true })
})
