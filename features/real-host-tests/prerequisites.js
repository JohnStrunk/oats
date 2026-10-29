import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { assertNoSystemConfig, systemSources } from '../steps/tui_smoke_helper.js'

export function requireRealHost(executable, { platform = process.platform, sources = systemSources() } = {}) {
  assert.notEqual(platform, 'win32', 'real-host session data test requires POSIX process cleanup')
  assert.ok(executable && isAbsolute(executable), 'OATS_OPENCODE must be an absolute path to the pinned OpenCode host')
  let version
  try {
    const stdout = execFileSync(executable, ['--version'], {
      encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'],
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
    })
    version = /^(?:opencode\s+)?v?(\d+\.\d+\.\d+)$/.exec(stdout.trim())?.[1]
  } catch {
    // Missing, inaccessible, or failing host is handled as a wrong version.
  }
  assert.equal(version, '2.0.32', `OATS_OPENCODE must point to executable OpenCode v2.0.32: ${executable}`)
  assertNoSystemConfig(sources)
  return { executable }
}
