import assert from 'node:assert/strict'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { After } from '@cucumber/cucumber'
import { launchSidebar, stopSidebar } from './sidebar_lifecycle_helper.js'
import { createSidebarTemp } from './sidebar_temp_helper.js'
export { agentIncomplete, amountFor, collapsedWithoutContent, displayedValue, historyState, rowFor, rowsFor, rowsRemain, sidebarAgentRows, sidebarRowsMatch, summaryNoticeAbsent } from './sidebar_section_helper.js'

const root = fileURLToPath(new URL('../..', import.meta.url))
const model = { providerID: 'fixture-provider', id: 'fixture-model' }
const tokens = { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
const msg = (id, agent, cost, recordedModel = model, recordedTokens = tokens, createdAt = 1) => ({
  id, type: 'assistant', time: { created: createdAt, completed: createdAt + 1 }, content: [], model: recordedModel, tokens: recordedTokens,
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
    failures: [], events: [], blockRoot: false, models: [],
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
    case 'model switch':
      fixture.sessions = [session('root'), session('new-root')]
      fixture.messages = {
        root: [msg('old-model-record', 'alpha', 1, { providerID: 'provider-one', id: 'old-model' })],
        'new-root': [msg('new-model-record', 'beta', 5, { providerID: 'provider-two', id: 'new-model' })],
      }
      break
    case 'model history':
      fixture.messages = {
        root: [
          msg('root-shared-one', 'alpha', 1, { providerID: 'provider-one', id: 'shared-model' }),
          msg('root-shared-two', 'beta', 2, { providerID: 'provider-two', id: 'shared-model' }),
          msg('root-model', 'alpha', 2, { providerID: 'provider-one', id: 'root-model' }),
        ],
        child: [msg('child-shared', 'worker', 1, { providerID: 'provider-three', id: 'shared-model' })],
        grandchild: [
          msg('grandchild-shared', 'nested', 2, { providerID: 'provider-four', id: 'shared-model' }),
          msg('grandchild-model', 'nested', 4, { providerID: 'provider-three', id: 'nested-model' }),
        ],
        child2: [msg('sibling-model', 'worker-two', 5, { providerID: 'provider-one', id: 'sibling-model' })],
        other: [msg('outside-model', 'other', 100, { providerID: 'provider-one', id: 'outside-model' })],
      }
      fixture.models = [{
        providerID: 'catalog-provider', id: 'currently-selected-model', name: 'currently-selected-model',
        cost: { input: 100, output: 100, cache: { read: 100, write: 100 } },
      }]
      break
    case 'model catalogue labels':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('catalogue-alpha', 'alpha', 3, { providerID: 'provider-one', id: 'alpha-id' }, tokens, 1),
        msg('catalogue-beta', 'beta', 5, { providerID: 'provider-two', id: 'beta-id' }, tokens, 2),
        msg('shared-id-first-provider', 'first-provider', 1, { providerID: 'provider-one', id: 'shared-id' }, tokens, 3),
        msg('shared-id-second-provider', 'second-provider', 2, { providerID: 'provider-two', id: 'shared-id' }, tokens, 4),
        msg('catalogue-entry-missing', 'no-entry', 7, { providerID: 'provider-three', id: 'no-entry-id' }, tokens, 5),
        msg('catalogue-name-missing', 'no-name', 11, { providerID: 'provider-four', id: 'no-name-id' }, tokens, 6),
        msg('catalogue-entry-later-provider', 'later-name', 2, { providerID: 'provider-two', id: 'no-entry-id' }, tokens, 7),
        msg('catalogue-name-empty', 'empty-name', 4, { providerID: 'provider-five', id: 'empty-name-id' }, tokens, 8),
        msg('catalogue-name-whitespace', 'whitespace-name', 6, { providerID: 'provider-six', id: 'whitespace-name-id' }, tokens, 9),
      ] }
      // Catalogue order deliberately differs from recorded-use order. Distinct
      // IDs share a display name, one ID has provider-specific names, and a
      // later name must not replace the earliest provider's missing entry.
      fixture.models = [
        { providerID: 'provider-two', id: 'beta-id', name: 'Shared Name' },
        { providerID: 'provider-one', id: 'alpha-id', name: 'Shared Name' },
        { providerID: 'provider-two', id: 'shared-id', name: 'Second Provider Name' },
        { providerID: 'provider-one', id: 'shared-id', name: 'First Provider Name' },
        { providerID: 'provider-two', id: 'no-entry-id', name: 'Borrowed Later Name' },
        { providerID: 'provider-four', id: 'no-name-id' },
        { providerID: 'provider-five', id: 'empty-name-id', name: '' },
        { providerID: 'provider-six', id: 'whitespace-name-id', name: '   ' },
        { providerID: 'catalog-provider', id: 'currently-selected-model', name: 'Currently Selected Model' },
      ]
      break
    case 'async client model catalogue':
      fixture.sessions = [session('root')]
      fixture.modelCatalogueSource = 'client'
      fixture.messages = { root: [
        msg('client-catalogue-first-provider', 'first', 2, { providerID: 'async-provider-one', id: 'async-model-id' }, tokens, 1),
        msg('client-catalogue-second-provider', 'second', 3, { providerID: 'async-provider-two', id: 'async-model-id' }, tokens, 2),
      ] }
      fixture.models = [
        { providerID: 'async-provider-two', id: 'async-model-id', name: 'Later Async Name' },
        { providerID: 'async-provider-one', id: 'async-model-id', name: 'Async Catalogue Name' },
      ]
      break
    case 'sorted costs':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('sort-low', 'agent-low', 0.011, { providerID: 'provider', id: 'model-low' }),
        msg('sort-high-first', 'agent-high', 0.009, { providerID: 'provider', id: 'model-high' }),
        msg('sort-high-repeat', 'agent-high', 0.010, { providerID: 'provider', id: 'model-high' }),
        msg('sort-high-shared-model', 'agent-high-extra', 0.0001, { providerID: 'provider', id: 'model-high' }),
        msg('sort-agent-tie-z', 'tie-agent-z', 4, { providerID: 'provider', id: 'tie-model-z' }),
        msg('sort-agent-tie-a', 'tie-agent-a', 4, { providerID: 'provider', id: 'tie-model-a' }),
        msg('sort-partial-known', 'partial-agent', 3.14, { providerID: 'provider', id: 'partial-model' }),
        msg('sort-partial-missing', 'partial-agent', null, { providerID: 'provider', id: 'partial-model' }),
        msg('sort-partial-tie-complete', 'complete-tie-agent', 3.14, { providerID: 'provider', id: 'complete-tie-model' }),
        msg('sort-unknown-only', 'unknown-agent', null, { providerID: 'provider', id: 'unknown-model' }),
        msg('sort-known-zero', 'known-zero-agent', 0, { providerID: 'provider', id: 'known-zero-model' }),
        msg('sort-negative-known', 'negative-agent', -1, { providerID: 'provider', id: 'negative-model' }),
        msg('sort-named-unattributed-tie', 'named-agent-tie', 2.75, { providerID: 'provider', id: 'named-model-tie' }),
        msg('sort-unattributed', null, 2.75, null),
      ] }
      break
    case 'model incomplete':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('model-zero', 'zero-agent', 0, { providerID: 'provider', id: 'zero-model' }),
        msg('model-partial-known', 'partial-agent', 2, { providerID: 'provider-one', id: 'partial-model' }),
        msg('model-partial-missing', 'partial-agent', null, { providerID: 'provider-two', id: 'partial-model' }),
        msg('model-unknown', 'unknown-agent', null, { providerID: 'provider', id: 'unknown-model' }),
        msg('model-unattributed-known', 'unattributed-agent', 3, null),
        msg('model-unattributed-missing', 'another-agent', null, { providerID: 'provider', id: '' }),
      ] }
      break
    case 'model unattributed':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('named-model', 'alpha', 1, { providerID: 'provider', id: 'named-model' }),
        msg('missing-model', 'beta', 2, null),
        msg('blank-model', 'gamma', 3, { providerID: 'provider', id: '' }),
        msg('whitespace-model', 'delta', null, { providerID: 'provider', id: '   ' }),
        msg('non-string-model', 'epsilon', 4, { providerID: 'provider', id: 17 }),
        msg('provider-only-model', 'zeta', 0, { providerID: 'provider' }),
        msg('literal-unattributed-model', 'eta', 7, { providerID: 'provider', id: 'Unattributed' }),
      ] }
      break
    case 'model rounding':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('model-zero', 'zero-agent', 0, { providerID: 'provider', id: 'zero-model' }),
        msg('model-exact', 'exact-agent', 1.25, { providerID: 'provider', id: 'exact-model' }),
        msg('model-sub-cent', 'tiny-agent', 0.000001, { providerID: 'provider', id: 'sub-cent-model' }),
        msg('model-sum-one', 'alpha', 0.1, { providerID: 'provider-one', id: 'sum-model' }),
        msg('model-sum-two', 'beta', 0.2, { providerID: 'provider-two', id: 'sum-model' }),
        msg('model-negative', 'negative-agent', -0.01001, { providerID: 'provider', id: 'negative-model' }),
      ] }
      break
    case 'model overflow':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('model-positive-bound', 'bound-agent', 10000, { providerID: 'provider', id: 'positive-bound' }),
        msg('model-negative-bound', 'bound-agent', -10000, { providerID: 'provider', id: 'negative-bound' }),
        msg('model-partial-bound', 'partial-bound-agent', 10000, { providerID: 'provider', id: 'partial-bound' }),
        msg('model-partial-bound-missing', 'partial-bound-agent', null, { providerID: 'provider', id: 'partial-bound' }),
        msg('model-at-limit', 'limit-agent', 9999.99, { providerID: 'provider', id: 'at-limit' }),
        msg('model-just-over-limit', 'over-limit-agent', 9999.990001, { providerID: 'provider', id: 'just-over-limit' }),
      ] }
      break
    case 'model reported cost':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg(
        'reported-model-cost', 'alpha', 1.234,
        { providerID: 'recorded-provider', id: 'reported-model' },
        { input: 1_000_000, output: 1_000_000, reasoning: 0, cache: { read: 0, write: 0 } },
      )] }
      fixture.models = [
        {
          providerID: 'recorded-provider', id: 'reported-model', name: 'reported-model',
          cost: { input: 1000, output: 1000, cache: { read: 1000, write: 1000 } },
        },
        {
          providerID: 'active-provider', id: 'currently-selected-model', name: 'currently-selected-model',
          cost: { input: 2000, output: 2000, cache: { read: 2000, write: 2000 } },
        },
      ]
      break
    case 'model name sizing': {
      fixture.sessions = [session('root')]
      const sharedPrefix = 'abcdefghijklmnopqrstuvwx0123456789'
      fixture.messages = { root: [
        msg('model-name-short', 'short-agent', 1, { providerID: 'provider', id: 'compact-model' }),
        msg('model-name-wide', 'wide-agent', 4, { providerID: 'provider', id: '代理模型' }),
        msg('model-name-long-alpha', 'long-alpha-agent', 2, { providerID: 'provider', id: `${sharedPrefix}-alpha` }),
        msg('model-name-long-beta', 'long-beta-agent', 3, { providerID: 'provider', id: `${sharedPrefix}-beta` }),
      ] }
      break
    }
    case 'model whitespace collision':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('model-space-id', 'space-agent', 1, { providerID: 'provider-one', id: 'shared model' }),
        msg('model-nbsp-id', 'nbsp-agent', 2, { providerID: 'provider-two', id: 'shared\u00a0model' }),
      ] }
      break
    case 'model label safety':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [
        msg('model-terminal-control', 'control-agent', 1, { providerID: 'provider', id: 'clip\x1b]52;c;YQ==\x07' }),
        msg('model-bidi-control', 'bidi-agent', 2, { providerID: 'provider', id: 'bidi\u202elabel' }),
        msg('catalogue-terminal-control', 'catalogue-control-agent', 3, { providerID: 'provider', id: 'catalogue-terminal-control-model' }),
        msg('catalogue-bidi-control', 'catalogue-bidi-agent', 4, { providerID: 'provider', id: 'catalogue-bidi-model' }),
        msg('catalogue-overlong-control', 'catalogue-overlong-agent', 5, { providerID: 'provider', id: 'catalogue-overlong-model' }),
        msg('catalogue-title-control', 'catalogue-title-agent', 6, { providerID: 'provider', id: 'catalogue-title-control-model' }),
        msg('catalogue-cursor-control', 'catalogue-cursor-agent', 7, { providerID: 'provider', id: 'catalogue-cursor-control-model' }),
      ] }
      fixture.models = [
        { providerID: 'provider', id: 'catalogue-terminal-control-model', name: 'namedclip\x1b]52;c;YQ==\x07' },
        { providerID: 'provider', id: 'catalogue-bidi-model', name: 'namedbidi\u202elabel' },
        { providerID: 'provider', id: 'catalogue-overlong-model', name: `catalogue-${'overlong-'.repeat(8)}\x1b]52;c;YQ==\x07\u202e-tail` },
        { providerID: 'provider', id: 'catalogue-title-control-model', name: '\x1b]0;OATS_NAME_SAFETY_TITLE\x1b\\' },
        { providerID: 'provider', id: 'catalogue-cursor-control-model', name: '\x1b[987;654H' },
      ]
      break
    case 'model notice label':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('model-notice-label', 'alpha', 1, { providerID: 'provider', id: 'Summary incomplete' })] }
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
    case 'summary incomplete agent':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('summary-incomplete', 'Summary incomplete', 1)] }
      break
    case 'aligned mixed':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('a', 'alpha', 0), msg('b1', 'beta', 1.2), msg('b2', 'beta', null), msg('c', 'gamma', null), msg('d', 'delta', -10000), msg('u1', null, 3), msg('u2', null, null)] }
      break
    case 'aligned complete':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('a', 'alpha', 0), msg('b', 'beta', 10000), msg('u', null, 3)] }
      break
    case 'aligned unknown':
      fixture.sessions = [session('root')]
      fixture.messages = { root: [msg('a', 'alpha', null), msg('u', null, null)] }
      break
    case 'name sizing': {
      fixture.sessions = [session('root')]
      const longComplete = 'abcdefghijklmnopqrstuvwx1234'
      const longUnknown = 'bcdefghijklmnopqrstuvwxy1234'
      const longIncomplete = 'cdefghijklmnopqrstuvwxy12345'
      fixture.messages = { root: [
        msg('name-short', 'short', 1),
        msg('name-medium', 'medium-agent-name', 2),
        msg('name-long-complete', longComplete, 3),
        msg('name-long-unknown', longUnknown, null),
        msg('name-long-incomplete', longIncomplete, 10000),
        msg('name-long-incomplete-missing', longIncomplete, null),
        msg('name-prefix-alpha', 'abcdefghijklmnop-alpha', 4),
        msg('name-prefix-beta', 'abcdefghijklmnop-beta', 5),
        msg('name-prefix-short-a', 'abcdefghijklmnop-a', 100),
        msg('name-prefix-short-b', 'abcdefghijklmnop-b', 6),
      ] }
      break
    }
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
    await writeSidebarAdapter({
      directory: pluginDir,
      controlPath: world.sidebarControl,
      oatsPath: path.join(root, 'tui.js'),
      captureTheme: world.sidebarTheme !== undefined,
    })
  }
  const { startSidebarPty } = await import('./sidebar_pty_driver.js')
  const sessionIDs = [world.sidebarFixture.route]
  if (world.sidebarFixture.sessions.some(item => item.id === 'ses_oats_new_root')) sessionIDs.push('ses_oats_new_root')
  await launchSidebar(world, () => startSidebarPty({ pluginPath: pluginDir, sessionID: world.sidebarFixture.route, sessionIDs, setupRoot: world.sidebarTemp, themeName: world.sidebarTheme }))
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

export async function toggle(world, method, sectionName = 'Agent stats') {
  const text = screen(world)
  const lines = text.split('\n')
  const y = lines.findIndex(line => line.includes(sectionName))
  assert.ok(y >= 0, `${sectionName} section must be visible before toggling`)
  const x = lines[y].indexOf(sectionName)
  const headingState = value => {
    const heading = value.split('\n').find(line => line.includes(sectionName)) ?? ''
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
    world.sidebarPty.send(sectionName)
    const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await eventually(world, value => new RegExp(`toggle.*${escaped}`, 'i').test(value),
      `the keyboard command palette does not offer a ${sectionName} toggle`)
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
