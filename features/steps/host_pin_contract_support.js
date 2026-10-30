import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getRepoRoot } from './workflow_helper.js'

const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
const versionsWithComponent = value => [`${value}.0.0`, `2.${value}.0`, `2.0.${value}`]
export const maxSafeHostPins = versionsWithComponent(maxSafe)
export const overlargeHostPins = versionsWithComponent(maxSafe + 1n)

// Exercise the checked-out CLI with only the dependency declaration changed.
// No source files or assertions are replaced in the disposable copy.
export function withPinnedCheckout(version, action) {
  const root = getRepoRoot()
  const temp = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-version-contract-'))
  const checkout = join(temp, 'checkout')
  try {
    cpSync(root, checkout, {
      recursive: true,
      filter: source => !source.split('/').some(part => ['.git', 'node_modules', '.ci-linters'].includes(part)),
    })
    symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir')
    const manifest = join(checkout, '.github/tooling/opencode-host/package.json')
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    pkg.dependencies['@opencode/cli'] = version
    writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n')
    return action(checkout, temp)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export function runCommand(cwd, command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  })
  return { status: result.status, signal: result.signal, error: result.error?.message, output: result.stdout + result.stderr }
}

function makeSelectedHost(temp, version) {
  const host = join(temp, 'selected-host')
  const marker = join(temp, 'selected-host-started')
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`
  // The version probe is safe; an attempted server start is observable and fails.
  writeFileSync(host, `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' ${quote(`opencode v${version}`)}; exit 0; fi\nprintf started > ${quote(marker)}\nexit 42\n`, { mode: 0o700 })
  rmSync(marker, { force: true })
  assert.equal(execFileSync(host, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim(), `opencode v${version}`)
  assert.equal(existsSync(marker), false, 'The version probe must not start the fixture')
  return { host, marker }
}

export function selectedHost(checkout, temp, version) {
  const { host, marker } = makeSelectedHost(temp, version)
  const result = runCommand(checkout, 'npm', ['run', 'test:real-host'], { OATS_OPENCODE: host })
  return { ...result, started: existsSync(marker) }
}

export function selectedTuiHost(checkout, temp, version) {
  const { host, marker } = makeSelectedHost(temp, version)
  const result = runCommand(checkout, './node_modules/.bin/cucumber-js', [
    'features/plugin-ui/when-opencode-v2-loads-the-locally-configured-oats-tui-plugin-the-plugin-ui-shall-present-an-oats-loaded-startup-toast.feature',
    '--name', '^The locally configured plugin starts in the TUI$',
  ], { OATS_OPENCODE: host })
  return { ...result, started: existsSync(marker) }
}
