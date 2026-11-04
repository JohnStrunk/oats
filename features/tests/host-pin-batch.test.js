import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { withPinnedCheckoutBatch } from '../steps/host_pin_contract_support.js'

const HOST_MANIFEST = '.github/tooling/opencode-host/package.json'
const pinnedVersion = checkout => JSON.parse(readFileSync(join(checkout, HOST_MANIFEST), 'utf8')).dependencies['@opencode/cli']

test('each batch case gets an isolated temp directory and its own rewritten pin', () => {
  const [first, second] = withPinnedCheckoutBatch(run => [
    run('2.18.42', (checkout, temp) => {
      writeFileSync(join(temp, 'selected-host-started'), 'started')
      return { temp, pin: pinnedVersion(checkout) }
    }),
    run('2.18.43', (checkout, temp) => ({
      temp,
      pin: pinnedVersion(checkout),
      markerVisible: existsSync(join(temp, 'selected-host-started')),
    })),
  ])
  assert.equal(first.pin, '2.18.42')
  assert.equal(second.pin, '2.18.43')
  assert.notEqual(first.temp, second.temp, 'cases must not share a temp directory')
  assert.equal(second.markerVisible, false, 'host stub markers must not leak between cases')
  assert.equal(existsSync(first.temp), false, 'batch cleanup removes per-case directories')
})

test('async tasks and actions fail fast instead of outliving checkout cleanup', () => {
  assert.throws(() => withPinnedCheckoutBatch(run => run('2.18.42', async () => 'late')), /must be synchronous/)
  assert.throws(() => withPinnedCheckoutBatch(async () => 'late'), /must be synchronous/)
})
