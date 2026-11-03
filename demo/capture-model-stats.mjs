import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { requireRealHost } from '../features/real-host-tests/prerequisites.js'
import { startSidebarServer } from '../features/real-host-tests/authenticated_server.js'
import { costRow, legendLines } from '../features/real-host-tests/sidebar_row_geometry.js'
import { startSidebarTui } from '../features/real-host-tests/tui_sidebar_harness.js'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEMO_TITLE = 'OATS issue 48 synthetic model stats demo'
const LEGEND = 'e = estimated'
const SECTION_HEADING = /^\s*([▼▶])\s+(Agent stats|Model stats)(?:\s+\([^)]+\))?\s*$/
const MODEL_ROWS = [
  { label: 'alpha-model', value: '$3.00', marker: '' },
  { label: 'beta-model', value: '$2.00', marker: 'e' },
  { label: 'gamma-model', value: 'unavailable', marker: '' },
  { label: 'zero-model', value: '$0.00', marker: '' },
  { label: 'Unattributed', value: '$1.00', marker: 'e' },
]

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function sectionHeading(lines, section) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = SECTION_HEADING.exec(lines[index])
    if (match?.[2] === section) {
      return { index, glyph: match[1], line: lines[index] }
    }
  }
  return undefined
}

function renderedRowsMatch(screen, rows, section) {
  return rows.every(expected => {
    const actual = costRow(screen, expected.label, section)
    return actual?.value === expected.value && actual.marker === expected.marker
  })
}

function assertCostRows(screen, rows, section) {
  for (const expected of rows) {
    const actual = costRow(screen, expected.label, section)
    assert.ok(actual, `${section} must render a row for "${expected.label}"`)
    assert.equal(actual.value, expected.value, `${section} "${expected.label}" value`)
    assert.equal(actual.marker, expected.marker, `${section} "${expected.label}" completeness marker`)
  }
}

function expandedSectionMatches(screen, rows, section) {
  return sectionHeading(screen.split('\n'), section)?.glyph === '▼' &&
    renderedRowsMatch(screen, rows, section) &&
    rows.some(row => row.marker === 'e') &&
    legendLines(screen, section).length === 1
}

function collapsedAgentWithExpandedModelMatches(screen, agentRows) {
  const agentHeading = sectionHeading(screen.split('\n'), 'Agent stats')
  const modelHeading = sectionHeading(screen.split('\n'), 'Model stats')
  return agentHeading?.glyph === '▶' &&
    agentRows.every(row => costRow(screen, row.label, 'Agent stats') === undefined) &&
    legendLines(screen, 'Agent stats').length === 0 &&
    modelHeading?.glyph === '▼' &&
    expandedSectionMatches(screen, MODEL_ROWS, 'Model stats')
}

async function waitForScreen(tui, predicate, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let screen
    try {
      screen = tui.screen()
    } catch {
      throw new Error(`The TUI ended while waiting for ${label}`)
    }
    if (predicate(screen)) return screen
    await delay(50)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function cropSection(screen, section, rows, { includeLegend = false } = {}) {
  const lines = screen.split('\n')
  const heading = sectionHeading(lines, section)
  assert.ok(heading, `Cannot crop missing ${section} section`)
  const nextHeading = lines.findIndex((line, index) =>
    index > heading.index && SECTION_HEADING.test(line),
  )
  const end = nextHeading < 0 ? lines.length : nextHeading
  const selected = new Set([heading.index])

  for (const expected of rows) {
    const rendered = costRow(screen, expected.label, section)
    assert.ok(rendered, `Cannot crop missing ${section} row "${expected.label}"`)
    const lineIndex = rendered.row - 1
    assert.ok(lineIndex > heading.index && lineIndex < end, `${section} row must stay in its section`)
    selected.add(lineIndex)
  }

  const legendIndexes = []
  for (let index = heading.index + 1; index < end; index += 1) {
    if (lines[index].trim() === LEGEND) legendIndexes.push(index)
  }
  if (includeLegend) {
    assert.equal(legendIndexes.length, 1, `${section} must render its legend exactly once`)
    selected.add(legendIndexes[0])
  } else {
    assert.equal(legendIndexes.length, 0, `Collapsed ${section} must not render its legend`)
  }

  const selectedLines = [...selected]
    .sort((left, right) => left - right)
    .map(index => lines[index].replace(/[█▀]/g, ' ').trimEnd())
  const sharedGutter = Math.min(...selectedLines.map(line => line.match(/^ */)[0].length))
  return selectedLines.map(line => line.slice(sharedGutter)).join('\n')
}

function cropSummaries(screen, agentRows, { agentExpanded }) {
  const agent = cropSection(screen, 'Agent stats', agentExpanded ? agentRows : [], {
    includeLegend: agentExpanded,
  })
  const model = cropSection(screen, 'Model stats', MODEL_ROWS, { includeLegend: true })
  return `${agent}\n${model}`
}

async function run() {
  const host = requireRealHost(process.env.OATS_OPENCODE)
  let server
  let tui
  let failure

  try {
    server = await startSidebarServer({
      executable: host.executable,
      title: DEMO_TITLE,
      prefix: 'oats-model-stats-demo-',
    })
    tui = await startSidebarTui({
      executable: host.executable,
      server,
      pluginPath: REPO_ROOT,
      cols: 160,
      rows: 45,
    })

    const agentRows = server.sessions.rows
    const expandedScreen = await waitForScreen(
      tui,
      screen => expandedSectionMatches(screen, agentRows, 'Agent stats') &&
        expandedSectionMatches(screen, MODEL_ROWS, 'Model stats'),
      'both expanded summaries and their expected rows',
    )
    assert.equal(sectionHeading(expandedScreen.split('\n'), 'Agent stats')?.glyph, '▼')
    assert.equal(sectionHeading(expandedScreen.split('\n'), 'Model stats')?.glyph, '▼')
    assertCostRows(expandedScreen, agentRows, 'Agent stats')
    assertCostRows(expandedScreen, MODEL_ROWS, 'Model stats')
    assert.equal(legendLines(expandedScreen, 'Agent stats').length, 1)
    assert.equal(legendLines(expandedScreen, 'Model stats').length, 1)

    console.log('=== Both summaries expanded ===')
    console.log(cropSummaries(expandedScreen, agentRows, { agentExpanded: true }))

    try {
      tui.click('Agent stats', 2)
    } catch {
      throw new Error('Could not deliver a PTY click to the rendered Agent stats heading')
    }

    const collapsedScreen = await waitForScreen(
      tui,
      screen => collapsedAgentWithExpandedModelMatches(screen, agentRows),
      'Agent stats rows to hide while Model stats remains expanded',
    )
    assert.equal(sectionHeading(collapsedScreen.split('\n'), 'Agent stats')?.glyph, '▶')
    assert.equal(sectionHeading(collapsedScreen.split('\n'), 'Model stats')?.glyph, '▼')
    for (const row of agentRows) {
      assert.equal(costRow(collapsedScreen, row.label, 'Agent stats'), undefined,
        `Collapsed Agent stats must hide "${row.label}"`)
    }
    assert.equal(legendLines(collapsedScreen, 'Agent stats').length, 0)
    assertCostRows(collapsedScreen, MODEL_ROWS, 'Model stats')
    assert.equal(legendLines(collapsedScreen, 'Model stats').length, 1)

    console.log('\n=== Agent stats collapsed; Model stats remains expanded ===')
    console.log(cropSummaries(collapsedScreen, agentRows, { agentExpanded: false }))
  } catch (error) {
    failure = error
  } finally {
    const cleanupErrors = []
    let retainServerRoot = false
    try {
      await tui?.close()
    } catch (error) {
      retainServerRoot = true
      server?.retainRoot?.()
      cleanupErrors.push(error)
    }
    try {
      await server?.close({ retain: retainServerRoot })
    } catch (error) {
      cleanupErrors.push(error)
    }
    if (cleanupErrors.length) {
      failure = failure
        ? new AggregateError([failure, ...cleanupErrors], 'Model stats demo and cleanup failed')
        : new AggregateError(cleanupErrors, 'Model stats demo cleanup failed')
    }
  }

  if (failure) throw failure
}

run().catch(error => {
  const details = error instanceof AggregateError
    ? error.errors.map(item => item instanceof Error ? item.message : String(item)).join('; ')
    : error instanceof Error ? error.message : String(error)
  console.error(`Model stats demo failed: ${details}`)
  process.exitCode = 1
})
