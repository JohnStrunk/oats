import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateUsageDetails,
  evaluateCallTierRate,
  extractCallTokens,
  findModel,
  renderPairTable,
  sanitizeText,
} from '../../src/pricing-attribution.js'

test('sanitizeText strips control and formatting characters', () => {
  assert.equal(sanitizeText('hello\x00world'), 'helloworld')
  assert.equal(sanitizeText('agent\x1b[31mname'), 'agent[31mname')
  assert.equal(sanitizeText('line1\nline2\rline3'), 'line1line2line3')
  assert.equal(sanitizeText('safe-agent-1'), 'safe-agent-1')
  assert.equal(sanitizeText(null), '')
  assert.equal(sanitizeText(123), '')
})

test('findModel resolves matching provider and model entries', () => {
  const models = [
    { providerID: 'anthropic', id: 'claude-3-5-sonnet', cost: { input: 3, output: 15 } },
    { providerID: 'openai', id: 'gpt-4o', cost: { input: 5, output: 15 } },
    { providerID: 'google', id: 'gemini-1.5-pro', cost: { input: 3.5, output: 10.5 } },
  ]

  assert.equal(
    findModel(models, { providerID: 'anthropic', id: 'claude-3-5-sonnet' }),
    models[0],
  )
  assert.equal(
    findModel(models, { providerID: 'openai', id: 'gpt-4o' }),
    models[1],
  )
  assert.equal(findModel(models, 'google/gemini-1.5-pro'), models[2])
  assert.equal(findModel(models, { providerID: 'unknown', id: 'foo' }), null)
  assert.equal(findModel(null, 'foo'), null)
})

test('extractCallTokens extracts non-cached input, output + reasoning, and cache tokens', () => {
  const raw = {
    input: 1000,
    output: 500,
    reasoning: 200,
    cache: {
      read: 300,
      write: 150,
    },
  }

  const extracted = extractCallTokens(raw)
  assert.equal(extracted.input, 1000)
  assert.equal(extracted.output, 700, 'output includes reasoning tokens')
  assert.equal(extracted.cacheRead, 300)
  assert.equal(extracted.cacheWrite, 150)
  assert.equal(extracted.known, true)
})

test('extractCallTokens handles missing, null, or partial tokens cleanly', () => {
  assert.deepEqual(extractCallTokens(null), {
    input: null,
    output: null,
    cacheWrite: null,
    cacheRead: null,
    known: false,
  })

  const partial = extractCallTokens({ input: 500 })
  assert.equal(partial.input, 500)
  assert.equal(partial.output, null)
  assert.equal(partial.cacheRead, null)
  assert.equal(partial.cacheWrite, null)
  assert.equal(partial.known, true)
})

test('evaluateCallTierRate respects strict context > tier.size threshold', () => {
  const costList = [
    {
      tier: { type: 'context', size: 100_000 },
      input: 10,
      output: 30,
      cache: { read: 2, write: 5 },
    },
    {
      tier: { type: 'context', size: 200_000 },
      input: 20,
      output: 60,
      cache: { read: 4, write: 10 },
    },
    {
      input: 5,
      output: 15,
      cache: { read: 1, write: 2.5 },
    },
  ]

  // Context = input + cache.read + cache.write = 50,000 + 30,000 + 20,000 = 100,000
  // Exactly equal to tier.size 100,000 -> does NOT qualify (strict >) -> untiered fallback
  const atThreshold = evaluateCallTierRate(costList, {
    input: 50_000,
    cache: { read: 30_000, write: 20_000 },
    output: 10_000,
    reasoning: 5_000,
  })
  assert.equal(atThreshold.input, 5, 'exact threshold boundary falls back to untiered')

  // Context = 100,001 -> strictly > 100,000 -> qualifies for first tier
  const aboveThreshold = evaluateCallTierRate(costList, {
    input: 50_001,
    cache: { read: 30_000, write: 20_000 },
  })
  assert.equal(aboveThreshold.input, 10, 'context > 100,000 selects 100k tier')

  // Context = 200,001 -> strictly > 200,000 -> qualifies for highest tier
  const aboveHighest = evaluateCallTierRate(costList, {
    input: 150_000,
    cache: { read: 50_001, write: 0 },
  })
  assert.equal(aboveHighest.input, 20, 'context > 200,000 selects 200k tier')
})

test('aggregateUsageDetails groups records and sorts by agent then model', () => {
  const records = [
    {
      agent: 'worker-b',
      model: { providerID: 'prov-1', id: 'model-z' },
      cost: 0.10,
      tokens: { input: 100, output: 50 },
    },
    {
      agent: 'worker-a',
      model: { providerID: 'prov-1', id: 'model-y' },
      cost: 0.20,
      tokens: { input: 200, output: 100 },
    },
    {
      agent: 'worker-a',
      model: { providerID: 'prov-1', id: 'model-x' },
      cost: 0.30,
      tokens: { input: 300, output: 150 },
    },
  ]

  const models = [
    { providerID: 'prov-1', id: 'model-x', cost: { input: 2, output: 4 } },
    { providerID: 'prov-1', id: 'model-y', cost: { input: 3, output: 6 } },
    { providerID: 'prov-1', id: 'model-z', cost: { input: 1, output: 2 } },
  ]

  const pairs = aggregateUsageDetails(records, models)
  assert.equal(pairs.length, 3)
  assert.equal(pairs[0].agentDisplay, 'worker-a')
  assert.equal(pairs[0].modelDisplay, 'prov-1/model-x')
  assert.equal(pairs[1].agentDisplay, 'worker-a')
  assert.equal(pairs[1].modelDisplay, 'prov-1/model-y')
  assert.equal(pairs[2].agentDisplay, 'worker-b')
  assert.equal(pairs[2].modelDisplay, 'prov-1/model-z')
})

test('aggregateUsageDetails formats reported cost with ceiling-to-cents and incomplete e', () => {
  const completeRecords = [
    {
      agent: 'lead',
      model: { providerID: 'p', id: 'm' },
      cost: 0.121, // rounds up to $0.13
      tokens: { input: 100 },
    },
  ]

  const pairComplete = aggregateUsageDetails(completeRecords, [])[0]
  assert.equal(pairComplete.reportedCost, '$0.13')

  const incompleteRecords = [
    {
      agent: 'lead',
      model: { providerID: 'p', id: 'm' },
      cost: 0.121,
      tokens: { input: 100 },
    },
    {
      agent: 'lead',
      model: { providerID: 'p', id: 'm' },
      cost: null, // missing cost marks total incomplete
      tokens: { input: 50 },
    },
  ]

  const pairIncomplete = aggregateUsageDetails(incompleteRecords, [])[0]
  assert.equal(pairIncomplete.reportedCost, '$0.13e')
})

test('aggregateUsageDetails shows mixed rates and estimates category costs', () => {
  const models = [
    {
      providerID: 'p',
      id: 'm',
      cost: [
        {
          tier: { type: 'context', size: 1000 },
          input: 10,
          output: 20,
        },
        {
          input: 2,
          output: 4,
        },
      ],
    },
  ]

  const records = [
    {
      agent: 'lead',
      model: { providerID: 'p', id: 'm' },
      cost: 0.05,
      tokens: { input: 500, output: 100 }, // context 500 -> untiered rate: input 2, output 4
    },
    {
      agent: 'lead',
      model: { providerID: 'p', id: 'm' },
      cost: 0.15,
      tokens: { input: 2000, output: 200 }, // context 2000 -> tier rate: input 10, output 20
    },
  ]

  const pair = aggregateUsageDetails(records, models)[0]
  // Because calls used different rates (2 vs 10, 4 vs 20), price row must show 'mixed'
  assert.equal(pair.price.input, 'mixed')
  assert.equal(pair.price.output, 'mixed')

  // Tokens sum
  assert.equal(pair.tokens.input, '2,500')
  assert.equal(pair.tokens.output, '300')

  // Cost estimates:
  // call 1 input: (500 * 2) / 1,000,000 = 0.001
  // call 2 input: (2000 * 10) / 1,000,000 = 0.020
  // total input estimate: 0.021 -> $0.02e
  assert.equal(pair.cost.input, '$0.02e')
})

test('renderPairTable outputs proper heading and 4-column layout', () => {
  const pair = {
    agentDisplay: 'planner',
    modelDisplay: 'probe/model-a',
    reportedCost: '$0.50',
    price: { input: '$2.00', output: '$4.00', cacheWrite: '—', cacheRead: '—' },
    tokens: { input: '100,000', output: '50,000', cacheWrite: '—', cacheRead: '—' },
    cost: { input: '$0.20e', output: '$0.20e', cacheWrite: '—', cacheRead: '—' },
  }

  const table = renderPairTable(pair)
  assert.ok(table.includes('planner - probe/model-a  $0.50'))
  assert.ok(table.includes('input'))
  assert.ok(table.includes('output'))
  assert.ok(table.includes('cache write'))
  assert.ok(table.includes('cache read'))
  assert.ok(table.includes('Price'))
  assert.ok(table.includes('Tokens'))
  assert.ok(table.includes('Cost'))
})
