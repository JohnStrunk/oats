import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'
import { configuredHostVersion } from '../host_pin_helper.js'

When('the real-host contract test is requested with {word} host', function (kind) {
  const pin = configuredHostVersion()
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-host-negative-'))
  try {
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    const marker = join(dir, 'fallback-used')
    // A matching PATH candidate would expose an illicit fallback.
    const quotedMarker = `'${marker.replaceAll("'", "'\\''")}'`
    writeFileSync(join(bin, 'opencode'), `#!/bin/sh\nprintf x > ${quotedMarker}\necho 'opencode v${pin}'\n`, { mode: 0o700 })
    assert.match(execFileSync(join(bin, 'opencode'), ['--version'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } }), new RegExp(`v${pin.replaceAll('.', '\\.')}`))
    assert.equal(readFileSync(marker, 'utf8'), 'x', 'Fallback marker fixture must detect invocation')
    unlinkSync(marker)
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}` }
    if (kind === 'no') delete env.OATS_OPENCODE
    else if (kind === 'missing') env.OATS_OPENCODE = join(dir, 'missing')
    else if (kind === 'relative') env.OATS_OPENCODE = 'opencode'
    else if (kind === 'wrong') {
      const wrong = join(dir, 'wrong')
      const wrongPin = pin === '1.0.0' ? '1.0.1' : '1.0.0'
      writeFileSync(wrong, `#!/bin/sh\necho 'opencode v${wrongPin}'\n`, { mode: 0o700 })
      env.OATS_OPENCODE = wrong
    } else throw new Error(`Unknown host fixture: ${kind}`)
    this.real_host_result = spawnSync('npm', ['run', 'test:real-host'], { cwd: getRepoRoot(), env, encoding: 'utf8', timeout: 30000 })
    this.real_host_fallback_used = existsSync(marker) ? readFileSync(marker, 'utf8') : ''
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
