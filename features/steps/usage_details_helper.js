import assert from 'node:assert/strict'
import { detailsFixture, message, model, usage } from './usage_details_fixture.js'
import { eventually, screen, startScenario, updateControl } from './sidebar_scenario_helper.js'

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
