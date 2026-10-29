import { When } from '@cucumber/cucumber'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REPO_ROOT, runTui } from '../tui_smoke_helper.js'
When('the isolated OpenCode TUI starts with the OATS entrypoint removed', { timeout: 90000 }, async function () {
  const copy = await mkdtemp(join(tmpdir(), 'oats-missing-entrypoint-'))
  try {
    await cp(join(REPO_ROOT, 'package.json'), join(copy, 'package.json'))
    await cp(join(REPO_ROOT, 'tui.js'), join(copy, 'tui.js'))
    await cp(join(REPO_ROOT, 'src'), join(copy, 'src'), { recursive: true })
    await rm(join(copy, 'src', 'tui.js'))
    this.tui_result = await runTui({ configureOats: true, hostileAncestor: this.hostile_ancestor, pluginPath: copy, observeAbsence: true })
  } finally {
    await rm(copy, { recursive: true, force: true })
  }
})
