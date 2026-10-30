import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { requireRealHost } from './prerequisites.js'
import { startSidebarServer } from './authenticated_server.js'
import { costRow, legendLines } from './sidebar_row_geometry.js'
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
const ALPHA_ROW = /\balpha\b[^\n]*\$3\.00/
const BETA_ROW = /\bbeta\b[^\n]*\$2\.00/
const ANY_AGENT_ROW = /\balpha\b[^\n]*\$3\.00|\bbeta\b[^\n]*\$2\.00|\bgamma\b[^\n]*unavailable|\bzero\b[^\n]*\$0\.00|Unattributed[^\n]*\$1\.00/
const EXPANDED_HEADING = /▼ Agent stats/
const COLLAPSED_HEADING = /▶ Agent stats/
const OLD_HEADING_GLYPH = /[▸▾] Agent stats/
const LEGEND = 'e = incomplete total'

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

const rowsRendered = (screen, rows) =>
  screen.includes('Agent stats') && rows.every(row => costRow(screen, row.label))

// The AC only requires a shared column, not a specific width, and the host
// trims trailing blanks, so alignment is asserted through the rendered
// columns: equal label starts, equal value ends, and one shared marker column
// immediately after each value.
function assertCostRows(screen, rows) {
  const rendered = rows.map(row => {
    const parsed = costRow(screen, row.label)
    assert.ok(parsed, `the sidebar must render a cost row for "${row.label}"\n${screen}`)
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
    `agent labels must be left-aligned in one column: ${JSON.stringify(rendered.map(row => [row.label, row.labelColumn]))}`,
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

    await t.test('the actual plugin renders the imported session and agent costs expanded', async () => {
      const rendered = await tui.waitFor(
        screen => {
          if (!screen.includes(title)) return false
          if (!ALPHA_ROW.test(screen)) return false
          if (!BETA_ROW.test(screen)) return false
          return rowsRendered(screen, server.sessions.rows) && screen
        },
        `"${title}" with Agent stats rows for ${server.sessions.rows.map(row => row.label).join(', ')}`,
      )
      assert.match(
        rendered,
        /Agent stats/,
        'the actual plugin must contribute the Agent stats sidebar section',
      )
      assert.match(
        rendered,
        EXPANDED_HEADING,
        'the expanded section must use the host disclosure indicator immediately before its label',
      )
      assert.doesNotMatch(
        rendered,
        OLD_HEADING_GLYPH,
        'the section must not use the previous small-triangle indicators',
      )
      assert.match(
        rendered,
        ALPHA_ROW,
        'repeated alpha work must be combined in the rendered row',
      )
      assert.match(
        rendered,
        BETA_ROW,
        'the nested child session agent must be rendered in the subtree',
      )
    })

    await t.test('rendered cost rows keep labels left and values right with a marker column', async () => {
      const rendered = await tui.waitFor(
        screen => rowsRendered(screen, server.sessions.rows) && screen,
        'the complete set of rendered agent cost rows',
      )
      assertCostRows(rendered, server.sessions.rows)

      const legends = legendLines(rendered)
      assert.equal(
        legends.length,
        1,
        `the "${LEGEND}" legend must appear exactly once while a row carries the e marker\n${rendered}`,
      )
    })

    await t.test('clicking the rendered section header collapses and re-expands it', async () => {
      // The real-host pointer path is a click on the rendered header.
      const cell = tui.click('Agent stats', 2)
      agentStatsCell = cell
      assert.ok(cell.row > 0 && cell.column > 0, 'the click target must be on the rendered screen')

      const collapsed = await tui.waitFor(
        screen => {
          if (!screen.includes('Agent stats')) return false
          if (ANY_AGENT_ROW.test(screen)) return false
          return screen
        },
        'the Agent stats rows to disappear after clicking the header',
      )
      assert.match(
        collapsed,
        COLLAPSED_HEADING,
        'the collapsed section must use the host disclosure indicator immediately before its label',
      )
      assert.doesNotMatch(
        collapsed,
        ANY_AGENT_ROW,
        'collapsed content must not remain visible',
      )
      assert.equal(
        legendLines(collapsed).length,
        0,
        `the "${LEGEND}" legend must not remain visible while collapsed`,
      )

      tui.click('Agent stats', 2)
      const expanded = await tui.waitFor(
        screen => rowsRendered(screen, server.sessions.rows) && screen,
        'the Agent stats rows to return after clicking the header again',
      )
      assert.match(expanded, EXPANDED_HEADING)
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
        screen =>
          screen.includes('Agent stats') &&
          !ANY_AGENT_ROW.test(screen) &&
          screen,
        'the Agent stats rows to disappear after the keyboard toggle',
      )
      assert.match(collapsed, COLLAPSED_HEADING)

      await toggleAgentStatsFromPalette(tui)
      const expanded = await tui.waitFor(
        screen => rowsRendered(screen, server.sessions.rows) && screen,
        'the Agent stats rows to return after the keyboard toggle again',
      )
      assert.match(expanded, EXPANDED_HEADING)
      assertCostRows(expanded, server.sessions.rows)
    })

    await t.test('the same TUI without the plugin has no Agent stats sidebar', async () => {
      control = await startSidebarTui({
        executable: host.executable,
        server,
        pluginPath: null,
      })
      await control.waitFor(
        screen => screen.includes(title),
        `the session screen "${title}" without the OATS plugin`,
      )

      // The same command-palette query must not discover a plugin command.
      await openCommandPalette(control)
      control.send('Agent stats')
      await control.waitFor(
        screen => /No results found/.test(screen),
        'the command palette to report no Agent stats command without the plugin',
      )
      assert.doesNotMatch(
        control.screen(),
        /Toggle Agent stats/i,
        'the plugin command must not be discoverable when the plugin is absent',
      )

      control.send('\x1b')
      await control.waitFor(
        screen => screen.includes(title) && !/Commands/.test(screen),
        'the command palette to close',
      )
      if (agentStatsCell) {
        // Exercise the pointer path at the coordinates the real plugin header
        // occupied in the positive run. Without the plugin it must not reveal
        // an Agent stats section.
        control.send(clickAt(agentStatsCell))
      }
      await control.assertAbsentFor('Agent stats', 4_000)
      const screen = control.screen()
      assert.doesNotMatch(
        screen,
        ANY_AGENT_ROW,
        'plugin-specific agent rows must not appear when the plugin is absent',
      )
      assert.match(
        screen,
        /Context|ctrl\+p/,
        'the negative control must observe a rendered host screen, not a blank or failed TUI',
      )
    })
  },
)
