import assert from 'node:assert/strict'
import test from 'node:test'
import plugin from '../../src/tui.js'
import {
  assistantMessage,
  makeSidebarHost,
  sessionInfo,
} from './sidebar-test-host.js'
import {
  costRows,
  legendCount,
  rowFor,
  rowsShareValueEnd,
} from './agent-stats-display-oracle.js'

// The OpenCode TUI host runs with Solid's client build. Rendering also needs
// OpenTUI's native renderer, which Node 26 exposes through --experimental-ffi.
// The portable `npm run test:unit` invocation has neither, so these checks
// self-skip there. CI runs the dedicated `test:unit:sidebar-ui` script with
// OATS_REQUIRE_SIDEBAR_UI=1, which turns a missing prerequisite into a failure
// instead of a skip.
const browserConditions =
  process.execArgv.some((arg) => arg.includes('conditions=browser')) ||
  (process.env.NODE_OPTIONS ?? '').includes('--conditions=browser')

let solid
let skipReason
if (!browserConditions) {
  skipReason =
    'requires Solid client conditions: node --conditions=browser --experimental-ffi --test'
} else {
  try {
    await import('node:ffi')
    solid = await import('@opentui/solid')
  } catch (error) {
    skipReason = `OpenTUI native renderer unavailable: ${error.message}`
  }
}

if (skipReason && process.env.OATS_REQUIRE_SIDEBAR_UI === '1') {
  throw new Error(`Sidebar UI tests are required but unavailable: ${skipReason}`)
}

const options = skipReason ? { skip: skipReason } : {}

const SIDEBAR_SLOTS = ['sidebar.content', 'sidebar.footer']
const PLACEMENTS = ['append', 'prepend', 'before', 'after', 'replace']
const targetsSidebar = (claim) =>
  SIDEBAR_SLOTS.some((slot) => PLACEMENTS.some((key) => claim[key] === slot))

async function mount(t, host) {
  const cleanup = await plugin.setup(host.context)
  const claim = host.claims.find(targetsSidebar)
  assert.ok(claim, 'the plugin must contribute to the session sidebar slot')

  const app = await solid.testRender(
    () => claim.render({
      get sessionID() {
        return host.displayedSessionID()
      },
    }),
    { width: 60, height: 24 },
  )

  t.after(async () => {
    try {
      await cleanup()
    } finally {
      app.renderer.destroy()
    }
  })

  return { app, claim, cleanup }
}

const frame = (app) => app.captureCharFrame()
const frameLines = (text) => text.split('\n').map((line) => line.trimStart())
const frameRows = (text) => costRows(frameLines(text))
const frameRow = (text, label) => rowFor(frameLines(text), label)
const command = (host) =>
  host.layers
    .flatMap((layer) => layer.commands ?? [])
    .find((entry) => /agent.?stats/i.test(entry.id) || /agent stats/i.test(entry.title))

test('contributes a renderable Agent stats section to the session sidebar', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const { app, claim } = await mount(t, host)

  assert.ok(targetsSidebar(claim))
  assert.equal(typeof claim.render, 'function')

  const rendered = await app.waitForFrame((text) => text.includes('Agent stats'))
  assert.match(rendered, /▼ Agent stats/)
})

test('starts expanded and shows one combined row per recorded agent name', options, async (t) => {
  const host = makeSidebarHost({
    sessions: [sessionInfo('root'), sessionInfo('child', 'root')],
    messages: {
      root: [
        assistantMessage('root-alpha', { agent: 'alpha', cost: 1 }),
        assistantMessage('root-beta', { agent: 'beta', cost: 2 }),
      ],
      child: [
        assistantMessage('child-alpha', { agent: 'alpha', cost: 7 }),
        assistantMessage('child-worker', { agent: 'worker', cost: 3 }),
      ],
    },
  })
  const { app } = await mount(t, host)

  const rendered = await app.waitForFrame((text) => frameRow(text, 'worker')?.value === '$3.00')
  assert.match(rendered, /▼ Agent stats/)
  assert.equal(frameRow(rendered, 'alpha').value, '$8.00')
  assert.equal(frameRow(rendered, 'beta').value, '$2.00')
  assert.equal(frameRow(rendered, 'worker').value, '$3.00')
  assert.equal(rendered.match(/alpha:/g).length, 1, 'repeated agent names combine into one row')
})

test('rounds zero, fractional, sub-cent and negative sub-cent costs to cents', options, async (t) => {
  const host = makeSidebarHost({
    messages: {
      root: [
        assistantMessage('zero', { agent: 'zero', cost: 0 }),
        assistantMessage('fraction', { agent: 'fraction', cost: 1.25 }),
        assistantMessage('tiny', { agent: 'tiny', cost: 0.0001 }),
        assistantMessage('negative', { agent: 'negative', cost: -0.001 }),
      ],
    },
  })
  const { app } = await mount(t, host)

  const rendered = await app.waitForFrame((text) => frameRow(text, 'tiny')?.value === '$0.01')
  assert.equal(frameRow(rendered, 'zero').value, '$0.00')
  assert.equal(frameRow(rendered, 'fraction').value, '$1.25')
  assert.equal(frameRow(rendered, 'tiny').value, '$0.01')
  assert.equal(frameRow(rendered, 'negative').value, '$0.00')
})

test('sums decimal records exactly and bounds overflowing totals', options, async (t) => {
  const host = makeSidebarHost({
    messages: {
      root: [
        assistantMessage('sum-a', { agent: 'sum', cost: 0.1 }),
        assistantMessage('sum-b', { agent: 'sum', cost: 0.2 }),
        assistantMessage('over', { agent: 'over', cost: 10_000 }),
        assistantMessage('under', { agent: 'under', cost: -10_000 }),
      ],
    },
  })
  const { app } = await mount(t, host)

  const rendered = await app.waitForFrame((text) => frameRow(text, 'sum')?.value === '$0.30')
  assert.equal(frameRow(rendered, 'sum').value, '$0.30')
  assert.equal(frameRow(rendered, 'over').value, '>$9999.99')
  assert.equal(frameRow(rendered, 'under').value, '<-$9999.99')
})

test('presents a blocked first read as loading rather than empty', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const blocked = host.blockHistory('root')
  const session = await mount(t, host)
  await blocked.entered
  await session.app.flush()

  const loading = await session.app.waitForFrame((text) =>
    /loading session history/i.test(text),
  )
  assert.match(loading, /loading session history/i)
  assert.ok(!loading.includes('No agent usage recorded'))
  blocked.release()
})

test('an empty read is not presented as loading or as unavailable', options, async (t) => {
  const host = makeSidebarHost({ messages: { root: [] } })
  const session = await mount(t, host)

  const rendered = await session.app.waitForFrame(
    (text) => !/loading session history/i.test(text),
  )
  // Benign gaps (the pinned host cannot prove retry usage) still describe an
  // empty history; withheld or failed history takes the unavailable path.
  assert.match(rendered, /No agent usage recorded/)
  assert.ok(!/loading session history/i.test(rendered))
  assert.ok(!/Session history unavailable/i.test(rendered))
})

test('identifies unavailable history without claiming confirmed empty history', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [] },
    failures: ['message.list:root'],
  })
  const { app } = await mount(t, host)

  const rendered = await app.waitForFrame((text) =>
    text.includes('Session history unavailable'),
  )
  assert.match(rendered, /Session history unavailable/)
  assert.match(rendered, /Summary incomplete/)
  assert.ok(!rendered.includes('No agent usage recorded'))
})

test('keeps known partial and unattributed costs visible as incomplete', options, async (t) => {
  const host = makeSidebarHost({
    messages: {
      root: [
        assistantMessage('partial-known', { agent: 'partial', cost: 2 }),
        assistantMessage('partial-missing', { agent: 'partial' }),
        assistantMessage('unknown', { agent: 'unknown' }),
        assistantMessage('anonymous', { cost: 3 }),
      ],
    },
  })
  const { app } = await mount(t, host)

  const rendered = await app.waitForFrame((text) =>
    frameRow(text, 'Unattributed')?.value === '$3.00',
  )
  assert.equal(frameRow(rendered, 'partial').value, '$2.00')
  assert.equal(frameRow(rendered, 'partial').marker, 'e')
  assert.equal(frameRow(rendered, 'unknown').value, 'unavailable')
  assert.equal(frameRow(rendered, 'unknown').marker, 'blank')
  assert.equal(frameRow(rendered, 'Unattributed').value, '$3.00')
  assert.equal(frameRow(rendered, 'Unattributed').marker, 'blank')
  assert.ok(!rendered.includes('unknown: $0.00'))
  assert.equal(legendCount(frameLines(rendered)), 1, 'one e marker yields one legend')
  assert.match(rendered, /Summary incomplete/)
})

test('updates a visible total when settled usage changes', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const { app } = await mount(t, host)

  await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  host.settleStep({ messageID: 'live-step', agent: 'alpha', cost: 4 })

  const updated = await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$5.00')
  assert.equal(frameRow(updated, 'alpha').value, '$5.00')
})

test('collapsing hides rows and expanding via mouse or keyboard shows them again', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const { app } = await mount(t, host)

  await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')

  await app.mockMouse.click(1, 0)
  const collapsed = await app.waitForFrame((text) => !text.includes('alpha:'))
  assert.match(collapsed, /▶ Agent stats/)

  await app.mockMouse.click(1, 0)
  const expanded = await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  assert.match(expanded, /▼ Agent stats/)

  const toggle = command(host)
  assert.ok(toggle, 'the plugin must register a keyboard command for Agent stats')
  toggle.run()
  await app.waitForFrame((text) => !text.includes('alpha:'))

  toggle.run()
  const reopened = await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  assert.match(reopened, /▼ Agent stats/)
})

test('a collapsed section still reflects settled usage when reopened', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const { app } = await mount(t, host)

  await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  await app.mockMouse.click(1, 0)
  await app.waitForFrame((text) => !text.includes('alpha:'))

  host.settleStep({ messageID: 'collapsed-live', agent: 'alpha', cost: 4 })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(!frame(app).includes('alpha:'))
  assert.equal(frameRow(frame(app), 'alpha'), null)

  await app.mockMouse.click(1, 0)
  const reopened = await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$5.00')
  assert.equal(frameRow(reopened, 'alpha').value, '$5.00')
})

test('switching sessions suppresses stale totals and preserves the expansion choice', options, async (t) => {
  const host = makeSidebarHost({
    sessions: [sessionInfo('root'), sessionInfo('new-root')],
    messages: {
      root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })],
      'new-root': [assistantMessage('new-agent-message', { agent: 'new-agent', cost: 5 })],
    },
  })
  const { app } = await mount(t, host)

  await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  await app.mockMouse.click(1, 0)
  await app.waitForFrame((text) => !text.includes('alpha:'))

  const blocked = host.blockHistory('new-root')
  host.setRoute({ type: 'session', sessionID: 'new-root' })
  host.emit({ type: 'session.viewed', data: { sessionID: 'new-root' } })
  await blocked.entered
  await app.flush()

  const loading = frame(app)
  assert.ok(!loading.includes('alpha:'), 'the previous session total must not remain visible')
  assert.match(loading, /▶ Agent stats/, 'the collapsed choice must survive the session change')

  await app.mockMouse.click(1, 0)
  const expandedLoading = await app.waitForFrame((text) =>
    /loading session history/i.test(text),
  )
  assert.ok(!expandedLoading.includes('alpha:'), 'loading must not expose stale totals')

  blocked.release()
  const switched = await app.waitForFrame((text) => frameRow(text, 'new-agent')?.value === '$5.00')
  assert.ok(!switched.includes('alpha:'), 'the previous session total must not return')
})

test('cleanup releases the sidebar contribution and host subscriptions', options, async (t) => {
  const host = makeSidebarHost({
    messages: { root: [assistantMessage('root-alpha', { agent: 'alpha', cost: 1 })] },
  })
  const { app, cleanup } = await mount(t, host)

  await app.waitForFrame((text) => frameRow(text, 'alpha')?.value === '$1.00')
  assert.equal(host.claims.length, 1)
  assert.ok(host.listenerCount('session.step.ended') > 0)

  await cleanup()
  assert.equal(host.claims.length, 0, 'the slot claim must be released')
  assert.equal(host.listenerCount('session.step.ended'), 0)
  assert.equal(host.allListenerCount(), 0)

  host.settleStep({ messageID: 'after-cleanup', agent: 'alpha', cost: 4 })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(host.claims.length, 0)
})
