import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { writeSidebarAdapter } from '../steps/sidebar_adapter.js'
import { launchSidebar, stopSidebar } from '../steps/sidebar_lifecycle_helper.js'
import { startSidebarPty } from '../steps/sidebar_pty_driver.js'
import { OUTPUT_LIMIT_MESSAGE, createOutputCapture } from '../steps/tui_smoke_helper.js'
import { createTempDir } from './temp_root.js'

test('pinned host displays bounded extreme costs and complete partial markers', { timeout: 90000 }, async () => {
  const temp = createTempDir('oats-extreme-test-')
  // stopSidebar owns both the PTY handle and this tree: it retains the adapter
  // and control data whenever cleanup cannot be confirmed, including a start
  // that throws after the supervisor may already be running.
  const world = { sidebarTemp: temp }
  const nodePty = await import('node-pty')
  const pty = nodePty.default ?? nodePty
  const spawn = pty.spawn
  const captured = createOutputCapture()
  pty.spawn = function (...args) {
    const terminal = spawn.apply(this, args)
    terminal.onData(chunk => { captured.append(chunk) })
    return terminal
  }
  const model = { providerID: 'fixture', id: 'fixture' }
  const tokens = { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
  const message = (id, agent, cost) => ({
    id, type: 'assistant', agent, model, tokens, content: [],
    time: { created: 1, completed: 2 }, ...(cost == null ? {} : { cost }),
  })
  try {
    const sessionID = 'ses_oats_extreme'
    const controlPath = join(temp, 'control.json')
    await writeFile(controlPath, JSON.stringify({
      route: sessionID, sessions: [{ id: sessionID }],
      messages: { [sessionID]: [
        message('min-known', 'tiny', Number.MIN_VALUE), message('min-missing', 'tiny', null),
        message('max-known', 'abcdefghijklmnop', 1e308), message('max-missing', 'abcdefghijklmnop', null),
      ] }, events: [], failures: [],
    }))
    const adapter = join(temp, 'adapter')
    await writeSidebarAdapter({ directory: adapter, controlPath, oatsPath: resolve('tui.js') })
    // Record the real host's nested theme values; the plugin receives the
    // original theme object, not a fake or replacement.
    const themePath = join(temp, 'theme.json')
    const entry = join(adapter, 'tui.js')
    const source = await readFile(entry, 'utf8')
    await writeFile(entry, source.replace("import { readFileSync }", "import { readFileSync, writeFileSync }")
      .replace('async setup(host) {', `async setup(host) {\n    writeFileSync(${JSON.stringify(themePath)}, JSON.stringify(host.theme.text))`))
    await launchSidebar(world, () => startSidebarPty({ pluginPath: adapter, sessionID, setupRoot: temp }))
    const tui = world.sidebarPty
    const frame = await tui.waitFor(screen => {
      const lines = screen.split('\n')
      return lines.some(line => line.includes('$0.01e')) &&
        lines.some(line => line.includes('>$9999.99e')) &&
        lines.some(line => line.trim() === 'e = incomplete total') && screen
    })
    assert.match(frame, /tiny[^\n]*\$0\.01e(?=\s|$)/)
    assert.match(frame, /abc[^\n]*>\$9999\.99e(?=\s|$)/)
    const theme = JSON.parse(await readFile(themePath, 'utf8'))
    assert.ok(theme.base && theme.muted, 'real host supplies nested base and muted text colors')
    assert.notDeepEqual(theme.base, theme.muted)
    const foregroundBefore = text => {
      assert.ok(!captured.overflow, OUTPUT_LIMIT_MESSAGE)
      const output = captured.text
      const at = output.indexOf(text)
      assert.ok(at >= 0, `real terminal output must contain ${text}`)
      const matches = [...output.slice(0, at).matchAll(/\x1b\[38;(?:2;(\d+);(\d+);(\d+)|5;(\d+))m/g)]
      assert.ok(matches.length, `foreground must be set before ${text}`)
      const match = matches.at(-1)
      if (match[4] == null) return match.slice(1, 4).map(Number)
      const index = Number(match[4])
      if (index === 8) return [128, 128, 128]
      if (index >= 232) return Array(3).fill(8 + 10 * (index - 232))
      assert.ok(index >= 16 && index <= 231, `unexpected indexed color ${index}`)
      const cube = index - 16
      const levels = [0, 95, 135, 175, 215, 255]
      return [levels[Math.floor(cube / 36)], levels[Math.floor(cube / 6) % 6], levels[cube % 6]]
    }
    const rgb = color => [color.buffer[0], color.buffer[1], color.buffer[2]]
    assert.deepEqual(foregroundBefore('Agent stats'), rgb(theme.base), 'heading uses host base text color')
    assert.deepEqual(foregroundBefore('tiny'), rgb(theme.muted), 'rows use host muted text color')
  } catch (error) {
    // Preserve the primary failure while still reporting an unconfirmed close;
    // stopSidebar keeps the PTY handle and the adapter/control tree in that case.
    try {
      await stopSidebar(world)
    } catch (cleanupError) {
      error.message += `; ${cleanupError.message}`
    }
    throw error
  } finally {
    pty.spawn = spawn
  }
  await stopSidebar(world)
})
