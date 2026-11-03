import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { requireRealHost } from './prerequisites.js'
import { startSidebarServer } from './authenticated_server.js'
import { costRow, hasSectionHeading, legendLines } from './sidebar_row_geometry.js'
import { clickAt } from './terminal_screen.js'
import { startSidebarTui } from './tui_sidebar_harness.js'

// Run with an explicitly selected pinned host:
//   OATS_OPENCODE=/absolute/path/to/opencode node features/real-host-tests/run-sidebar.js
//
// This is the vertical-slice check for issue #6: the real OATS entrypoint is
// loaded by the pinned OpenCode TUI, the TUI connects to an isolated
// authenticated local server, and synthetic sessions are imported through the
// real HTTP client. Assertions read the rendered screen, not raw historical
// output. The no-plugin scenario is the negative control.
//
// It also covers the issue #34 display conventions on the real host: the
// host's disclosure indicators, labels left and values right in a shared
// column, the `e` marker immediately after a known incomplete total, the
// reserved blank after complete and unknown totals, and the legend.
//
// The test fails (never skips) when the host is absent, the wrong version, or
// isolation cannot be established. No model call is made.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const MAX_TEST_MS = 180_000
// Expected model IDs and totals from authenticated_server.js: alpha's $1 + $2
// calls, beta's settled $2 plus an unsettled call, gamma's missing cost, zero's
// reported $0, and the known $1 plus unsettled unattributed compaction usage.
const MODEL_ROWS = [
  { label: 'alpha-model', value: '$3.00', marker: '' },
  { label: 'beta-model', value: '$2.00', marker: 'e' },
  { label: 'gamma-model', value: 'unavailable', marker: '' },
  { label: 'zero-model', value: '$0.00', marker: '' },
  { label: 'Unattributed', value: '$1.00', marker: 'e' },
]
const EXPANDED_AGENT_HEADING = /▼ Agent stats/
const COLLAPSED_AGENT_HEADING = /▶ Agent stats/
const OLD_AGENT_HEADING_GLYPH = /[▸▾] Agent stats/
const EXPANDED_MODEL_HEADING = /▼ Model stats/
const LEGEND = 'e = estimated'

async function openCommandPalette(tui) {
  tui.send('\x10')
  await tui.waitFor(
    screen => /Commands/.test(screen) && /Search/.test(screen),
    'the command palette to open',
  )
}

async function toggleAgentStatsFromPalette(tui) {
  await openCommandPalette(tui)
  tui.send('Agent stats')
  await tui.waitFor(
    screen => /Toggle Agent stats/i.test(screen),
    'the command palette to offer Toggle Agent stats',
  )
  tui.send('\r')
}

async function assertCommandUnavailable(tui, query, commandPattern) {
  await openCommandPalette(tui)
  tui.send(query)
  await tui.waitFor(
    screen => /No results found/.test(screen),
    `the command palette to report no ${query} command without the plugin`,
  )
  assert.doesNotMatch(
    tui.screen(),
    commandPattern,
    `the ${query} plugin command must not be discoverable when the plugin is absent`,
  )

  tui.send('\x1b')
  await tui.waitFor(
    screen => !/Commands/.test(screen),
    'the command palette to close',
  )
}

const rowsRendered = (screen, rows, section = 'Agent stats') =>
  hasSectionHeading(screen, section) &&
  rows.every(row => costRow(screen, row.label, section))

const anyRowsRendered = (screen, rows, section = 'Agent stats') =>
  rows.some(row => costRow(screen, row.label, section))

function agentCollapsedWithModelVisible(screen, agentRows) {
  if (!hasSectionHeading(screen, 'Agent stats')) return false
  if (anyRowsRendered(screen, agentRows, 'Agent stats')) return false
  if (!hasSectionHeading(screen, 'Model stats')) return false
  if (!rowsRendered(screen, MODEL_ROWS, 'Model stats')) return false
  return screen
}

function assertAgentCollapsedWithModelVisible(screen, agentRows) {
  assert.match(
    screen,
    COLLAPSED_AGENT_HEADING,
    'the collapsed Agent stats section must use the host disclosure indicator',
  )
  assert.doesNotMatch(screen, EXPANDED_AGENT_HEADING, 'Agent stats must be collapsed')
  assert.equal(
    anyRowsRendered(screen, agentRows, 'Agent stats'),
    false,
    'Agent stats rows must not remain visible after collapse',
  )
  assertCostRows(screen, MODEL_ROWS, 'Model stats')
  assert.match(
    screen,
    EXPANDED_MODEL_HEADING,
    'collapsing Agent stats must leave Model stats expanded',
  )
  assert.equal(
    legendLines(screen, 'Agent stats').length,
    0,
    `the "${LEGEND}" legend must not remain visible in collapsed Agent stats`,
  )
  assert.equal(
    legendLines(screen, 'Model stats').length,
    1,
    `the "${LEGEND}" legend must remain visible in expanded Model stats`,
  )
}

// The AC only requires a shared column, not a specific width, and the host
// trims trailing blanks, so alignment is asserted through the rendered
// columns: equal label starts, equal value ends, and one shared marker column
// immediately after each value.
function assertCostRows(screen, rows, section = 'Agent stats') {
  const rendered = rows.map(row => {
    const parsed = costRow(screen, row.label, section)
    assert.ok(parsed, `the ${section} sidebar must render a cost row for "${row.label}"\n${screen}`)
    return parsed
  })

  rows.forEach((row, index) => {
    const parsed = rendered[index]
    assert.equal(parsed.value, row.value, `"${row.label}" must show ${row.value}`)
    assert.equal(
      parsed.marker,
      row.marker,
      `"${row.label}" must carry ${row.marker ? `the ${row.marker} marker` : 'no e marker'} ` +
        `immediately after its value: ${JSON.stringify(parsed.line)}`,
    )
  })

  const labelColumns = [...new Set(rendered.map(row => row.labelColumn))]
  assert.equal(
    labelColumns.length,
    1,
    `${section} labels must be left-aligned in one column: ${JSON.stringify(rendered.map(row => [row.label, row.labelColumn]))}`,
  )

  const valueEndColumns = [...new Set(rendered.map(row => row.valueEndColumn))]
  assert.equal(
    valueEndColumns.length,
    1,
    'values of different widths must be right-aligned to one shared end column: ' +
      JSON.stringify(rendered.map(row => [row.label, row.valueEndColumn])),
  )

  const markerColumns = [...new Set(rendered.map(row => row.markerColumn))]
  assert.equal(
    markerColumns.length,
    1,
    `the marker column must follow the shared value end column: ${JSON.stringify(rendered.map(row => [row.label, row.markerColumn]))}`,
  )

  assert.ok(
    valueEndColumns[0] - labelColumns[0] >= 30,
    `cost values must be right-aligned across the sidebar width (span was ${valueEndColumns[0] - labelColumns[0]}): ` +
      JSON.stringify(rendered.map(row => [row.label, row.labelColumn, row.valueEndColumn])),
  )
  return rendered
}

test(
  'the real pinned OpenCode TUI renders and toggles the actual OATS Agent stats sidebar',
  { timeout: MAX_TEST_MS },
  async t => {
    const host = requireRealHost(process.env.OATS_OPENCODE)
    const title = `Sidebar real-host ${randomBytes(4).toString('hex')}`
    const server = await startSidebarServer({ executable: host.executable, title })

    let tui
    let control
    let agentStatsCell
    t.after(async () => {
      const errors = []
      let retain = false
      for (const resource of [control, tui]) {
        try {
          await resource?.close()
        } catch (error) {
          retain = true
          errors.push(error)
        }
      }
      try {
        await server.close({ retain })
      } catch (error) {
        errors.push(error)
      }
      if (errors.length) throw new AggregateError(errors, 'real-host sidebar cleanup failed')
    })

    tui = await startSidebarTui({
      executable: host.executable,
      server,
      pluginPath: REPO_ROOT,
    })

    await t.test('the actual plugin renders both imported-session summary sections expanded', async () => {
      const rendered = await tui.waitFor(
        screen => {
          if (!screen.includes(title)) return false
          if (!rowsRendered(screen, server.sessions.rows)) return false
          if (!rowsRendered(screen, MODEL_ROWS, 'Model stats')) return false
          return screen
        },
        `"${title}" with Agent stats rows and Model stats rows for ${MODEL_ROWS.map(row => row.label).join(', ')}`,
      )
      assert.match(
        rendered,
        /Agent stats/,
        'the actual plugin must contribute the Agent stats sidebar section',
      )
      assert.match(
        rendered,
        EXPANDED_AGENT_HEADING,
        'the expanded section must use the host disclosure indicator immediately before its label',
      )
      assert.match(
        rendered,
        EXPANDED_MODEL_HEADING,
        'the Model stats section must be expanded beside Agent stats',
      )
      assert.doesNotMatch(
        rendered,
        OLD_AGENT_HEADING_GLYPH,
        'the Agent stats section must not use the previous small-triangle indicators',
      )
      assert.doesNotMatch(
        rendered,
        /^\s*Summary incomplete\s*$/m,
        'the section must not add a standalone summary-incomplete notice',
      )
      assertCostRows(rendered, server.sessions.rows)
    })

    await t.test('rendered cost rows keep labels left and values right with a marker column', async () => {
      const rendered = await tui.waitFor(
        screen =>
          rowsRendered(screen, server.sessions.rows) &&
          rowsRendered(screen, MODEL_ROWS, 'Model stats') &&
          screen,
        'the complete set of rendered Agent stats and Model stats cost rows',
      )
      assertCostRows(rendered, server.sessions.rows)
      assertCostRows(rendered, MODEL_ROWS, 'Model stats')

      const agentLegends = legendLines(rendered, 'Agent stats')
      assert.equal(
        agentLegends.length,
        1,
        `the "${LEGEND}" legend must appear exactly once in Agent stats while a row carries the e marker\n${rendered}`,
      )
      const modelLegends = legendLines(rendered, 'Model stats')
      assert.equal(
        modelLegends.length,
        1,
        `the "${LEGEND}" legend must appear exactly once in Model stats while a row carries the e marker\n${rendered}`,
      )
    })

    await t.test('clicking the rendered section header collapses and re-expands it', async () => {
      // The real-host pointer path is a click on the rendered header.
      const cell = tui.click('Agent stats', 2)
      agentStatsCell = cell
      assert.ok(cell.row > 0 && cell.column > 0, 'the click target must be on the rendered screen')

      const collapsed = await tui.waitFor(
        screen => agentCollapsedWithModelVisible(screen, server.sessions.rows),
        'Agent stats rows to disappear while Model stats remains visible after clicking the header',
      )
      assertAgentCollapsedWithModelVisible(collapsed, server.sessions.rows)

      tui.click('Agent stats', 2)
      const expanded = await tui.waitFor(
        screen =>
          rowsRendered(screen, server.sessions.rows) &&
          rowsRendered(screen, MODEL_ROWS, 'Model stats') &&
          screen,
        'the Agent stats rows to return after clicking the header again',
      )
      assert.match(expanded, EXPANDED_AGENT_HEADING)
      assertCostRows(expanded, server.sessions.rows)
    })

    await t.test('the command palette keyboard path collapses and re-expands the section', async () => {
      // shortcut: the direct Ctrl+Shift+A binding was not reachable through raw
      // PTY input on this host, so the keyboard path uses the host's documented
      // command palette (Ctrl+P), which is the same user-visible activation.
      // Upgrade to a direct binding assertion if the host exposes a reliable
      // modifier encoding for Ctrl+Shift+A.
      await toggleAgentStatsFromPalette(tui)
      const collapsed = await tui.waitFor(
        screen => agentCollapsedWithModelVisible(screen, server.sessions.rows),
        'Agent stats rows to disappear while Model stats remains visible after the keyboard toggle',
      )
      assertAgentCollapsedWithModelVisible(collapsed, server.sessions.rows)

      await toggleAgentStatsFromPalette(tui)
      const expanded = await tui.waitFor(
        screen =>
          rowsRendered(screen, server.sessions.rows) &&
          rowsRendered(screen, MODEL_ROWS, 'Model stats') &&
          screen,
        'the Agent stats rows to return after the keyboard toggle again',
      )
      assert.match(expanded, EXPANDED_AGENT_HEADING)
      assertCostRows(expanded, server.sessions.rows)
    })

    await t.test('the same TUI without the plugin has neither stats section or command', async () => {
      control = await startSidebarTui({
        executable: host.executable,
        server,
        pluginPath: null,
      })
      await control.waitFor(
        screen => screen.includes(title),
        `the session screen "${title}" without the OATS plugin`,
      )

      await assertCommandUnavailable(control, 'Agent stats', /Toggle Agent stats/i)
      await assertCommandUnavailable(control, 'Model stats', /Toggle Model stats/i)

      await control.waitFor(
        screen => screen.includes(title) && !/Commands/.test(screen),
        'the command palette to close and the session screen to return',
      )
      if (agentStatsCell) {
        // Exercise the pointer path at the coordinates the real plugin header
        // occupied in the positive run. Without the plugin it must not reveal
        // either plugin stats section.
        control.send(clickAt(agentStatsCell))
      }
      await control.assertAbsentFor('Agent stats', 4_000)
      await control.assertAbsentFor('Model stats', 4_000)
      const screen = control.screen()
      assert.equal(
        hasSectionHeading(screen, 'Agent stats'),
        false,
        'the Agent stats section must not appear when the plugin is absent',
      )
      assert.equal(
        hasSectionHeading(screen, 'Model stats'),
        false,
        'the Model stats section must not appear when the plugin is absent',
      )
      assert.match(
        screen,
        /Context|ctrl\+p/,
        'the negative control must observe a rendered host screen, not a blank or failed TUI',
      )
    })
  },
)
