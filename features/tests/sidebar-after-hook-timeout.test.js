import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createSidebarTemp } from '../steps/sidebar_temp_helper.js'

const execFileAsync = promisify(execFile)
const repo = fileURLToPath(new URL('../..', import.meta.url))
const cucumber = path.join(repo, 'node_modules/@cucumber/cucumber/bin/cucumber.js')
const cucumberApi = pathToFileURL(createRequire(import.meta.url).resolve('@cucumber/cucumber')).href
const sidebarSupport = new URL('../steps/sidebar_scenario_helper.js', import.meta.url).href

async function runFixture({ fail }) {
  const root = await createSidebarTemp('sidebar-after-hook-test-')
  try {
    const owned = path.join(root, 'scenario-owned')
    const marker = path.join(root, 'close-completed')
    await mkdir(owned)
    await writeFile(path.join(owned, 'control.json'), 'fixture')
    const steps = path.join(root, 'steps.mjs')
    await writeFile(steps, `import { Given } from ${JSON.stringify(cucumberApi)}
import { writeFile } from 'node:fs/promises'
import ${JSON.stringify(sidebarSupport)}
Given('a sidebar cleanup fixture', function () {
  this.sidebarTemp = ${JSON.stringify(owned)}
  this.sidebarPty = { close: async () => {
    ${fail ? "throw new Error('fixture close failed')" : `await new Promise(resolve => setTimeout(resolve, 5300)); await writeFile(${JSON.stringify(marker)}, 'closed')`}
  } }
})
`)
    const config = path.join(root, 'cucumber.mjs')
    await writeFile(config, "export default { import: ['steps.mjs'] }\n")
    const feature = path.join(root, 'fixture.feature')
    await writeFile(feature, 'Feature: cleanup fixture\n  Scenario: cleanup runs\n    Given a sidebar cleanup fixture\n')
    let result
    try {
      result = await execFileAsync(process.execPath, [cucumber, '--config', 'cucumber.mjs', '--format', 'progress', 'fixture.feature'], {
        cwd: root, timeout: 20000, maxBuffer: 1024 * 1024,
      })
    } catch (error) {
      if (!fail) throw error
      result = error
    }
    if (fail) {
      assert.notEqual(result.code, 0, 'failed cleanup must fail the scenario')
      assert.match(`${result.stdout}\n${result.stderr}`, /fixture close failed/)
      assert.equal(await readFile(path.join(owned, 'control.json'), 'utf8'), 'fixture')
    } else {
      assert.match(result.stdout, /1 scenario \(1 passed\)/)
      assert.equal(await readFile(marker, 'utf8'), 'closed')
      await assert.rejects(readFile(path.join(owned, 'control.json')), { code: 'ENOENT' })
    }
  } finally { await rm(root, { recursive: true, force: true }) }
}

test('Cucumber waits beyond its default timeout for sidebar cleanup', { timeout: 25000 }, async () => {
  await runFixture({ fail: false })
})

test('Cucumber still fails when sidebar cleanup fails', { timeout: 25000 }, async () => {
  await runFixture({ fail: true })
})
