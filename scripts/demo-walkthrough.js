import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { requireRealHost } from '../features/real-host-tests/prerequisites.js'
import { startSidebarServer } from '../features/real-host-tests/authenticated_server.js'
import { startSidebarTui } from '../features/real-host-tests/tui_sidebar_harness.js'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

function normalizeScreen(screen) {
  // Normalize nondeterministic temp paths, session IDs, scrollbar glyphs, and blank lines
  return screen
    .replace(/[█▀]/g, ' ')
    .replace(/OATS Demo [0-9a-f]+/g, 'OATS Demo session')
    .replace(/\/tmp\/opencode\/[^\s]+/g, '/tmp/opencode/isolated-demo-project')
    .replace(/\/…\/[^\s]+/g, '/…/isolated-demo-project')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{4,}/g, '\n\n')
}

async function run() {
  const host = requireRealHost(process.env.OATS_OPENCODE)
  const title = 'OATS Demo session'
  const server = await startSidebarServer({ executable: host.executable, title })

  let tui
  try {
    tui = await startSidebarTui({
      executable: host.executable,
      server,
      pluginPath: REPO_ROOT,
    })

    // Step 1: Wait for sidebar with "Agent stats (details)"
    console.log('=== Step 1: Sidebar with Agent stats (details) ===')
    const sidebarScreen = await tui.waitFor(
      screen => {
        if (!screen.includes('Agent stats (details)')) return false
        if (!screen.includes('alpha')) return false
        return screen
      },
      'sidebar to render "Agent stats (details)"',
    )
    console.log(normalizeScreen(sidebarScreen))

    // Step 2: Click "(details)" link
    console.log('\n=== Step 2: Clicking (details) link ===')
    const detailsCell = tui.click('(details)')
    console.log(`Clicked (details) at row ${detailsCell.row}, column ${detailsCell.column}`)

    // Step 3: Wait for Usage Details Modal
    console.log('\n=== Step 3: Usage Details Modal Rendered ===')
    const modalScreen = await tui.waitFor(
      screen => {
        if (!screen.includes('Usage Details') && !screen.includes('alpha -') && !screen.includes('input')) return false
        return screen
      },
      'usage details modal to open and render table',
    )
    console.log(normalizeScreen(modalScreen))

    console.log('\nDemo successfully verified against live OpenCode TUI.')
  } finally {
    try {
      await tui?.close()
    } catch (e) {
      console.error('TUI cleanup error:', e)
    }
    try {
      await server?.close()
    } catch (e) {
      console.error('Server cleanup error:', e)
    }
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
