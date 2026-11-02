import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configuredHostVersion } from '../features/steps/host_pin_helper.js'
import { writeSidebarAdapter } from '../features/steps/sidebar_adapter.js'
import { createSidebarTemp } from '../features/steps/sidebar_temp_helper.js'
import { startSidebarPty } from '../features/steps/sidebar_pty_driver.js'
import { detailsFixture, firstScrollAgent } from '../features/steps/usage_details_fixture.js'
import { aggregateUsageDetails } from '../src/pricing-attribution.js'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const fixture = detailsFixture('scroll mixed unicode')
const ROOT_SESSION = fixture.rootSession
// Reuse the plugin's own aggregation so the expected heading matches exactly,
// including the incomplete-cost "e" suffix and the bound placeholders.
const headingPair = aggregateUsageDetails(fixture.messages[ROOT_SESSION], fixture.models)
  .find(pair => pair.agentDisplay === firstScrollAgent('scroll mixed unicode'))
if (!headingPair) throw new Error(`The "scroll mixed unicode" fixture has no table for its first agent`)
const heading = `${headingPair.agentDisplay} - ${headingPair.modelDisplay}  ${headingPair.reportedCost}`
const TABLE_COUNT = fixture.messages[ROOT_SESSION].length
// Match startScenario's session policy, including any standalone root session.
const SESSION_IDS = fixture.sessions.map(session => session.id)

async function run() {
  const setupRoot = await createSidebarTemp('oats-issue-43-demo-')
  const controlPath = path.join(setupRoot, 'control.json')
  const pluginPath = path.join(setupRoot, 'adapter')
  // The fixture adapter and control file live in setupRoot. After a launch
  // attempt they may only be removed once no host process can still read them.
  const retainedNote = `; cleanup unconfirmed, retained ${setupRoot}`
  let tui
  let launchAttempted = false
  let bodyError

  try {
    await mkdir(pluginPath)
    await writeFile(controlPath, JSON.stringify(fixture))
    await writeSidebarAdapter({
      directory: pluginPath,
      controlPath,
      oatsPath: path.join(REPO_ROOT, 'tui.js'),
    })

    launchAttempted = true
    try {
      tui = await startSidebarPty({
        pluginPath,
        sessionID: ROOT_SESSION,
        sessionIDs: SESSION_IDS,
        setupRoot,
      })
    } catch (error) {
      // startSidebarPty only reports cleanup for its own internal root, not
      // the caller's setupRoot, so treat the launch as fail-closed.
      error.message += retainedNote
      throw error
    }

    const sidebar = await tui.waitFor(screen => (screen.includes('Agent stats (details)') ? screen : null))
    const sidebarLines = sidebar.split('\n')
    const sidebarRow = sidebarLines.findIndex(line => line.includes('Agent stats (details)'))
    const sidebarColumn = sidebarLines[sidebarRow].indexOf('(details)')
    tui.send(`\x1b[<0;${sidebarColumn + 2};${sidebarRow + 1}M\x1b[<0;${sidebarColumn + 2};${sidebarRow + 1}m`)

    const modal = await tui.waitFor(screen => (screen.includes(heading) && screen.includes('cache read') ? screen : null))
    const modalLines = modal.split('\n')
    const headingRow = modalLines.findIndex(line => line.includes(heading))

    console.log(`OpenCode ${configuredHostVersion()} TUI — synthetic mixed-width overflow fixture`)
    console.log(`The ${TABLE_COUNT}-table modal scrolls; the scrollbar is shown beside the mixed-width heading and table.`)
    console.log(modalLines.slice(Math.max(0, headingRow - 2), headingRow + 6).map(line => line.trimEnd()).join('\n'))
  } catch (error) {
    bodyError = error
  } finally {
    let closeError
    if (tui) {
      try {
        await tui.close()
      } catch (error) {
        closeError = error
        error.message += retainedNote
      }
    }
    const cleanupConfirmed = !launchAttempted || (tui && !closeError)
    if (cleanupConfirmed) await rm(setupRoot, { recursive: true, force: true })
    if (closeError) {
      closeError.cause ??= bodyError
      throw closeError
    }
    if (bodyError) throw bodyError
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
