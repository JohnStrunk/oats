import assert from 'node:assert/strict'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { After } from '@cucumber/cucumber'
import { launchSidebar, stopSidebar } from './sidebar_lifecycle_helper.js'
import { createSidebarTemp } from './sidebar_temp_helper.js'
export { agentIncomplete, amountFor, collapsedWithoutContent, displayedValue, historyState, rowFor, rowsFor, rowsRemain, sidebarAgentRows, sidebarRowsMatch, summaryIncomplete } from './sidebar_section_helper.js'

const root = fileURLToPath(new URL('../..', import.meta.url))
const model = { providerID: 'fixture-provider', id: 'fixture-model' }
const tokens = { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
const msg = (id, agent, cost) => ({
  id, type: 'assistant', time: { created: 1, completed: 2 }, content: [], model, tokens,
  ...(agent == null ? {} : { agent }),
  ...(cost == null ? {} : { cost }),
})

export function makeSidebarFixture(name) {
  const session = (id, parentID) => ({ id, ...(parentID ? { parentID } : {}) })
  const fixture = {
    route: 'root',
    sessions: [session('root'), session('child', 'root'), session('grandchild', 'child'), session('child2', 'root'), session('other')],
    messages: {
      root: [msg('r1', 'alpha', 1), msg('r2', 'beta', 2)],
      child: [msg('c1', 'worker', 3)],
      grandchild: [msg('g1', 'nested', 4)],
      child2: [msg('c2', 'worker-two', 3)],
      other: [msg('o1', 'other', 10)],
    },
    failures: [], events: [], blockRoot: false,
  }
  switch (name) {
    case 'history': break
    case 'switch':
    case 'blocked old session':
    case 'blocked new session':
      fixture.sessions.push(session('new-root'))
      fixture.messages['new-root'] = [msg('new-m', 'new-agent', 5)]
      fixture.blockRoot = name === 'blocked old session'
      break
    case 'repeated nested history':
      fixture.messages.child[0].agent = 'alpha'
      fixture.messages.grandchild[0].agent = 'alpha'
      break
    case 'formatting':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('zero', 'zero', 0), msg('fraction', 'fraction', 1.25), msg('tiny', 'tiny', 0.000001)] }
      break
    case 'incomplete':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('partial-1', 'partial', 2), msg('partial-2', 'partial', null), msg('unknown', 'unknown', null), msg('unattributed', null, 3)] }
      break
    case 'partial failure':
      fixture.failures = ['message:child:0']
      break
    case 'unavailable history':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [] }
      fixture.failures = ['message:root:0']
      break
    case 'empty history':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [] }
      break
    case 'blocked history': fixture.blockRoot = true; break
    default: throw new Error(`unknown Agent stats fixture: ${name}`)
  }
  const sessionId = id => `ses_oats_${id.replaceAll('-', '_')}`
  fixture.rootSession = sessionId('root')
  if (name === 'blocked new session') fixture.blockSessions = [sessionId('new-root')]
  fixture.route = fixture.rootSession
  fixture.sessions = fixture.sessions.map(s => ({
    ...s, id: sessionId(s.id), ...(s.parentID ? { parentID: sessionId(s.parentID) } : {}),
  }))
  fixture.messages = Object.fromEntries(Object.entries(fixture.messages).map(([id, records]) => [sessionId(id), records]))
  fixture.failures = fixture.failures.map(failure => failure.replace(/^(message|session):([^:]+):/, (_, op, id) => `${op}:${sessionId(id)}:`))
  return fixture
}

export async function writeControl(world) {
  const next = `${world.sidebarControl}.next`
  await writeFile(next, JSON.stringify(world.sidebarFixture))
  await rename(next, world.sidebarControl)
}

export async function startScenario(world, name, initialFixture) {
  world.sidebarFixture = initialFixture ?? makeSidebarFixture(name)
  world.sidebarTemp = await createSidebarTemp('oats-sidebar-')
  world.sidebarControl = path.join(world.sidebarTemp, 'control.json')
  await writeControl(world)
  const pluginDir = path.join(world.sidebarTemp, 'adapter')
  await mkdir(pluginDir)
  if (world.sidebarDisabled) {
    await writeFile(path.join(pluginDir, 'package.json'), JSON.stringify({ name: 'sidebar-negative-control', private: true, type: 'module' }))
    await writeFile(path.join(pluginDir, 'tui.js'), "export default { id: 'sidebar.negative.control', setup() {} }\n")
  } else {
    const { writeSidebarAdapter } = await import('./sidebar_adapter.js')
    await writeSidebarAdapter({ directory: pluginDir, controlPath: world.sidebarControl, oatsPath: path.join(root, 'tui.js') })
  }
  const { startSidebarPty } = await import('./sidebar_pty_driver.js')
  const sessionIDs = [world.sidebarFixture.route]
  if (world.sidebarFixture.sessions.some(item => item.id === 'ses_oats_new_root')) sessionIDs.push('ses_oats_new_root')
  await launchSidebar(world, () => startSidebarPty({ pluginPath: pluginDir, sessionID: world.sidebarFixture.route, sessionIDs, setupRoot: world.sidebarTemp }))
}

export async function stopScenario(world) {
  await stopSidebar(world)
}

// Supervisor cleanup can spend up to 10s awaiting a report, 10s awaiting the
// PTY close, then another 10s on the failure-path drain. Allow another 15s for
// scheduling and removal of the isolated scenario directory.
After({ timeout: 45000 }, async function () { await stopScenario(this) })

export function screen(world) {
  assert.ok(world.sidebarPty, 'the sidebar TUI has not started')
  const value = world.sidebarPty.screen()
  return Array.isArray(value) ? value.join('\n') : String(value)
}

export async function eventually(world, predicate, explanation) {
  const deadline = Date.now() + 10000
  let last
  while (Date.now() < deadline) {
    last = screen(world)
    if (predicate(last)) return last
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  assert.fail(`${explanation}\nLast terminal screen:\n${last}`)
}

export async function waitForBlockedRead(world, sessionID) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const value = await readFile(`${world.sidebarControl}.blocked`, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return ''
      throw error
    })
    if (value === sessionID) return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  assert.fail(`the host did not enter the blocked history read for ${sessionID}`)
}

export async function waitForCompletedRead(world, sessionID) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const value = await readFile(`${world.sidebarControl}.completed`, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return ''
      throw error
    })
    if (value === sessionID) return
    await new Promise(resolve => setTimeout(resolve, 40))
  }
  assert.fail(`the released host history read did not complete for ${sessionID}`)
}

export async function updateControl(world, change) {
  change(world.sidebarFixture)
  await writeControl(world)
}

export async function toggle(world, method) {
  const text = screen(world)
  const lines = text.split('\n')
  const y = lines.findIndex(line => line.includes('Agent stats'))
  assert.ok(y >= 0, 'Agent stats section must be visible before toggling')
  const x = lines[y].indexOf('Agent stats')
  const headingState = value => {
    const heading = value.split('\n').find(line => line.includes('Agent stats')) ?? ''
    if (/[▾▼]/.test(heading)) return true
    if (/[▸▶]/.test(heading)) return false
    return undefined
  }
  const before = headingState(text)
  const waitForTransition = async () => {
    if (before === undefined) return
    await eventually(world, value => {
      const after = headingState(value)
      return after !== undefined && after !== before
    }, 'the keyboard or mouse activation did not change the section expansion state')
  }
  if (method === 'mouse') {
    // XTerm SGR mouse press and release at the rendered heading.
    world.sidebarPty.send(`\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`)
  } else if (method === 'keyboard') {
    // Exercise the documented host command palette using only terminal input.
    world.sidebarPty.send('\x10')
    await new Promise(resolve => setTimeout(resolve, 200))
    world.sidebarPty.send('Agent stats')
    await eventually(world, value => /toggle.*agent stats/i.test(value), 'the keyboard command palette does not offer an Agent stats toggle')
    world.sidebarPty.send('\r')
  } else throw new Error(`unknown toggle input: ${method}`)
  await waitForTransition()
}

export function recordSettlement(fixture, agent, cost) {
  const n = fixture.events.length + 1
  const common = { sessionID: fixture.route, assistantMessageID: `live-${n}` }
  fixture.events.push(
    { id: `start-${n}`, type: 'session.step.started', created: n * 10, data: { ...common, agent, model } },
    { id: `end-${n}`, type: 'session.step.ended', created: n * 10 + 1, data: { ...common, cost, tokens, finish: 'stop' } },
  )
}

export function setTinyCost(fixture, cost) {
  fixture.messages[fixture.rootSession] = [msg('tiny', 'tiny', cost)]
  fixture.events.push({ id: `refresh-${fixture.events.length}`, type: 'session.moved', data: { sessionID: fixture.rootSession } })
}
