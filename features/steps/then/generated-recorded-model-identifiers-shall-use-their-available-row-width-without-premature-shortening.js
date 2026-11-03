import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { eventually, updateControl } from '../sidebar_scenario_helper.js'
import { inspectGeneratedModelName } from '../sidebar_model_alignment_helper.js'

const tokens = { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }

Then('generated recorded model identifiers shall use their available row width without premature shortening', { timeout: 180000 }, async function () {
  await fc.assert(fc.asyncProperty(
    fc.array(fc.integer({ min: 1, max: 90 }), { minLength: 6, maxLength: 12 }),
    async (lengths) => {
      for (const [index, length] of lengths.entries()) {
        const identifier = `model-${'x'.repeat(length)}`
        const cost = 100 + index
        await updateControl(this, fixture => {
          fixture.messages[fixture.rootSession] = [{
            id: `generated-model-name-${length}-${index}`,
            type: 'assistant',
            agent: 'generated-agent',
            model: { providerID: 'recorded-provider', id: identifier },
            cost,
            tokens,
            content: [],
            time: { created: index + 1, completed: index + 2 },
          }]
          fixture.events.push({
            id: `refresh-model-name-${length}-${index}`,
            type: 'session.moved',
            data: { sessionID: fixture.rootSession },
          })
        })
        await eventually(this, text => inspectGeneratedModelName(text, identifier, cost),
          `model identifier length ${length} must fit the row width without premature shortening`)
      }
    },
  ), { numRuns: 8, seed: 480050 })
})
