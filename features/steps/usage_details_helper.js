import assert from 'node:assert/strict'
import { eventually, screen, startScenario, updateControl } from './sidebar_scenario_helper.js'

const model = { providerID: 'fixture-provider', id: 'fixture-model' }
const usage = { input: 400000, output: 300000, reasoning: 200000, cache: { write: 250000, read: 500000 } }
const message = (id, agent, chosenModel = model, cost = 1, tokens = usage) => ({
  id, type: 'assistant', agent, model: chosenModel, cost, tokens,
  time: { created: 1, completed: 2 }, content: [],
})
const modelInfo = (providerID = 'fixture-provider', id = 'fixture-model') => ({
  providerID, id, modelID: id, name: id, status: 'active', enabled: true,
  cost: [{ input: 5, output: 2, cache: { write: 6, read: 7 } }],
  variants: [], time: { released: 0 }, capabilities: { tools: true, input: ['text'], output: ['text'] },
  limit: { context: 1000000, output: 100000 },
})

export function detailsFixture(kind) {
  const root = 'ses_oats_root', child = 'ses_oats_child', other = 'ses_oats_new_root'
  const fixture = {
    rootSession: root, route: root,
    sessions: [{ id: root }, { id: child, parentID: root }, { id: other }],
    messages: {
      [root]: [message('one', 'alpha')],
      [child]: [message('two', 'alpha', model, 2)],
      [other]: [message('other', 'other-agent', model, 99)],
    },
    models: [modelInfo()], failures: [], events: [], blockRoot: false,
  }
  if (kind === 'switch') fixture.messages[other] = [message('new', 'new-agent', model, 5)]
  else if (kind === 'providers') {
    fixture.messages[root] = ['provider-a', 'provider-b'].map((providerID, i) =>
      message(`p${i}`, 'alpha', { providerID, id: 'fixture-model' }, i + 1))
    fixture.messages[child] = []
    fixture.models = ['provider-a', 'provider-b'].map(id => modelInfo(id))
  } else if (kind === 'sorting') {
    fixture.messages[root] = [
      message('b', 'beta', { providerID: 'p', id: 'z-model' }),
      message('az', 'alpha', { providerID: 'p', id: 'z-model' }),
      message('aa', 'alpha', { providerID: 'p', id: 'a-model' }),
    ]
    fixture.messages[child] = []
    fixture.models = ['a-model', 'z-model'].map(id => modelInfo('p', id))
  } else if (kind === 'unknown') {
    fixture.messages[root] = [message('known', 'alpha', model, 2, null), message('missing', 'alpha', model, null, null)]
    fixture.messages[child] = []
    fixture.models = []
  } else if (kind === 'partial tokens') {
    fixture.messages[root] = [message('known', 'alpha'), message('missing', 'alpha', model, 2, null)]
    fixture.messages[child] = []
  } else if (kind === 'unattributed') {
    fixture.messages[root] = [message('no-agent', null, model, 1), message('no-model', 'alpha', null, 2)]
    fixture.messages[child] = []
  } else if (kind === 'scroll') {
    fixture.messages[root] = Array.from({ length: 25 }, (_, i) => message(`s${i}`, `agent-${String(i).padStart(2, '0')}`))
    fixture.messages[child] = []
  } else if (kind !== 'single pair' && kind !== 'switch') throw new Error(`Unknown fixture: ${kind}`)
  return fixture
}

export async function startDetails(world) {
  await startScenario(world, 'history', detailsFixture(world.detailsFixtureName))
}

export async function clickDetails(world) {
  const text = await eventually(world, text => text.split('\n').some(line => line.includes('Agent stats (details)')), 'the Agent stats details link must be visible')
  const lines = text.split('\n')
  const y = lines.findIndex(line => line.includes('Agent stats (details)'))
  const x = lines[y].indexOf('(details)')
  world.sidebarPty.send(`\x1b[<0;${x + 2};${y + 1}M\x1b[<0;${x + 2};${y + 1}m`)
}

export async function modal(world) {
  return eventually(world, text => /\bPrice\b/.test(text) && /\bTokens\b/.test(text) && /\bCost\b/.test(text), 'the usage details modal must show its table')
}

export const lineWith = (text, label) => text.split('\n').find(line => new RegExp(`\\b${label}\\b`, 'i').test(line)) ?? ''

// Compare numeric row values without requiring decorative currency symbols,
// separators, alignment, or a particular number of trailing fractional zeros.
export function rowNumbers(text, label) {
  const line = lineWith(text, label).replace(new RegExp(`.*?\\b${label}\\b`, 'i'), '')
  return (line.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(value => Number(value.replaceAll(',', '')))
}

export function markedNumbers(text, label) {
  const values = lineWith(text, label).replace(new RegExp(`.*?\\b${label}\\b`, 'i'), '')
  return (values.match(/(?:e\s*\$?-?\d[\d,]*(?:\.\d+)?|\$?-?\d[\d,]*(?:\.\d+)?\s*e)/g) ?? []).length
}

export function assertHeading(text, agent, modelID, amount) {
  const line = text.split('\n').find(value => value.includes(agent) && value.includes(modelID) && value.includes(amount))
  assert.ok(line, `Missing ${agent} - ${modelID} reported ${amount}:\n${text}`)
  assert.ok(line.includes(`${agent} - `), 'heading must use the requested agent - model separator')
  assert.ok(line.includes(`  ${amount}`), 'heading must separate the model and amount with two spaces')
}

export async function refreshPair(world, cents) {
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = cents.map((value, index) => message(`generated-${index}`, 'alpha', model, value / 100))
    fixture.messages.ses_oats_child = []
    fixture.events.push({ id: `generated-refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
}

export async function refreshInput(world, input) {
  await updateControl(world, fixture => {
    fixture.messages[fixture.rootSession] = [message('generated-input', 'alpha', model, 1, { ...usage, input })]
    fixture.messages.ses_oats_child = []
    fixture.events.push({ id: `input-refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
  })
}

export { eventually, screen, updateControl, message, model, usage }
