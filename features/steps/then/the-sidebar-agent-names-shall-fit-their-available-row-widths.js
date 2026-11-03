import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { eventually, updateControl } from '../sidebar_scenario_helper.js'
import { inspectAgentNameSizing } from '../sidebar_alignment_helper.js'

const suffix = fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 3 })
  .map(characters => characters.join(''))

Then('the sidebar agent names shall fit their available row widths:', { timeout: 180000 }, async function (table) {
  const expected = table.hashes()
  if (expected.some(row => !['blank', 'e'].includes(row.marker))) throw new Error('invalid expected marker')
  if (expected.some(row => !['yes', 'no'].includes(row.must_be_full))) throw new Error('invalid full-name expectation')
  await eventually(this, text => inspectAgentNameSizing(text, expected),
    'agent names must use each row\'s available width without hiding its value or marker')

  let generation = 0
  await fc.assert(fc.asyncProperty(
    fc.integer({ min: 1, max: 50 }), fc.constantFrom('complete', 'unknown'),
    async (length, kind) => {
      const name = `generated-agent-${'x'.repeat(length)}`
      const id = generation++
      await updateControl(this, fixture => {
        const template = fixture.messages[fixture.rootSession][0]
        const record = { ...template, id: `name-width-${id}`, agent: name }
        if (kind === 'unknown') delete record.cost
        else record.cost = 3.25
        fixture.messages[fixture.rootSession] = [record]
        fixture.events.push({ id: `name-width-refresh-${id}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
      })
      const row = [{ name, value: kind === 'unknown' ? 'unavailable' : '$3.25', marker: 'blank' }]
      await eventually(this, text => inspectAgentNameSizing(text, row),
      `generated ${kind} row for ${JSON.stringify(name)} must use its available name width`)
    },
  ), { seed: 470047, numRuns: 20, endOnFailure: true })

  await fc.assert(fc.asyncProperty(
    fc.tuple(suffix, suffix).filter(([first, second]) => first !== second),
    async ([firstSuffix, secondSuffix]) => {
      const id = generation++
      const pair = [
        { name: `abcdefghijklmnop-${firstSuffix}`, value: '$3.25', cost: 3.25 },
        { name: `abcdefghijklmnop-${secondSuffix}`, value: '$100.25', cost: 100.25 },
      ].map(item => ({ ...item, marker: 'blank', must_be_full: 'yes' }))
      await updateControl(this, fixture => {
        const template = fixture.messages[fixture.rootSession][0]
        fixture.messages[fixture.rootSession] = pair.map((item, index) => ({
          ...template,
          id: `name-width-pair-${id}-${index}`,
          agent: item.name,
          cost: item.cost,
        }))
        fixture.events.push({ id: `name-width-pair-refresh-${id}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
      })
      await eventually(this, text => inspectAgentNameSizing(text, pair),
        `both full names sharing the old 16-cell prefix must remain distinct when they fit: ${pair.map(item => item.name).join(', ')}`)
    },
  ), { seed: 470048, numRuns: 6, endOnFailure: true })
})
