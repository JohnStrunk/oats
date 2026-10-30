import assert from 'node:assert/strict'
import { eventually, updateControl } from './sidebar_scenario_helper.js'

const root = 'ses_name_safety'
const model = { providerID: 'fixture', id: 'fixture' }
const tokens = { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
const message = (id, agent, cost) => ({ id, type: 'assistant', agent, cost, model, tokens, content: [], time: { created: 1, completed: 2 } })

export function safetyFixture() {
  return { route: root, sessions: [{ id: root }], messages: { [root]: [] }, failures: [], events: [], blockRoot: false }
}

// Observe the host's actual PTY output, including non-screen OSC effects. This
// wraps only PTY creation; the plugin, TUI renderer and host remain real.
export async function observeSidebarOutput(world) {
  const module = await import('node-pty')
  const pty = module.default ?? module
  const original = pty.spawn
  world.nameSafetyOutput = ''
  pty.spawn = function (...args) {
    const terminal = original.apply(this, args)
    terminal.onData(chunk => { world.nameSafetyOutput += chunk })
    return terminal
  }
  return () => { pty.spawn = original }
}

export async function checkNameSafety(world, hostile, index) {
  // Both distinct names become identical if controls are simply replaced;
  // the repeated first name must still aggregate separately from the second.
  const first = `risky${hostile}\x01`
  const second = `risky${hostile}\x02`
  const firstCost = 100 + index * 3
  const secondCost = firstCost + 1
  const guardCost = firstCost + 2
  const before = world.nameSafetyOutput.length
  await updateControl(world, fixture => {
    fixture.messages[root] = [
      message(`a${index}`, first, firstCost - 1), message(`b${index}`, first, 1),
      message(`c${index}`, second, secondCost), message(`d${index}`, 'guard-agent', guardCost),
    ]
    fixture.events.push({ id: `refresh-name-${index}`, type: 'session.moved', data: { sessionID: root } })
  })
  const costs = [firstCost, secondCost, guardCost].map(n => `$${n}.00`)
  const screen = await eventually(world, text => costs.every(cost => text.includes(cost)),
    `three original-name totals must each remain visible for case ${index}`)
  const rows = screen.split('\n')
  for (const cost of costs) {
    const matches = rows.filter(row => row.includes(cost))
    assert.equal(matches.length, 1, `expected exactly one visible row for ${cost}`)
    assert.equal(costs.filter(other => matches[0].includes(other)).length, 1, 'distinct totals must occupy distinct rows')
  }
  const heading = rows.findIndex(row => row.includes('Agent stats'))
  assert.ok(heading >= 0, 'Agent stats heading must remain visible')
  assert.deepEqual(costs.map(cost => rows.findIndex(row => row.includes(cost))).sort((a, b) => a - b),
    [heading + 1, heading + 2, heading + 3], 'the three original-name totals must occupy exactly three rows')
  assert.ok(rows.find(row => row.includes(costs[2])).includes('guard-agent'), 'unrelated attribution must remain intact')
  assert.ok(!rows.some(row => row.includes('FORGED: $999.00') && !costs.some(cost => row.includes(cost))), 'a name must not spoof a separate row')
  assert.doesNotMatch(screen, /[\u202a-\u202e\u2066-\u2069]/u, 'bidirectional formatting must not reach the displayed screen')
  const output = world.nameSafetyOutput.slice(before)
  assert.doesNotMatch(output, /(?:\x1b\]|\u009d)52;c;T0FUU19TRUNVUklUWV9PU0M=/u, 'a name must not issue an OSC clipboard command')
  assert.doesNotMatch(output, /\x1b\]0;OATS_NAME_SAFETY_TITLE/u, 'a name must not issue an OSC title command')
  assert.doesNotMatch(output, /(?:\x1b\[|\u009b)987;654H/u, 'a name must not issue a cursor-positioning command')
  assert.doesNotMatch(output, /[\u202a-\u202e\u2066-\u2069]/u, 'bidirectional controls must not reach the terminal')
}
