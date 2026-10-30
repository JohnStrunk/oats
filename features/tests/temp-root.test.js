import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { createIsolatedRoot } from '../real-host-tests/authenticated_server.js'
import { createTempDir, tempRootBase } from '../real-host-tests/temp_root.js'

function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'oats-temp-root-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('an absent preferred root falls back without creating it', t => {
  const dir = temporary(t)
  const preferred = join(dir, 'absent')
  const fallback = join(dir, 'fallback')
  mkdirSync(fallback)
  assert.equal(tempRootBase({ preferred, fallback }), fallback)
  assert.equal(existsSync(preferred), false, 'the resolver must not create the shared root')
})

test('a preferred file is not used as a directory', t => {
  const dir = temporary(t)
  const preferred = join(dir, 'not-a-directory')
  writeFileSync(preferred, 'other work')
  assert.equal(tempRootBase({ preferred, fallback: dir }), dir)
  assert.equal(readFileSync(preferred, 'utf8'), 'other work')
})

test('an absent preferred root creates under the fallback', t => {
  const dir = temporary(t)
  const preferred = join(dir, 'absent')
  const fallback = join(dir, 'fallback')
  mkdirSync(fallback)
  const created = createTempDir('oats-created-', { preferred, fallback })
  t.after(() => rmSync(created, { recursive: true, force: true }))
  assert.equal(dirname(created), fallback)
  assert.equal(existsSync(preferred), false)
})

test('an existing preferred directory is used without deleting other work', t => {
  const dir = temporary(t)
  const preferred = join(dir, 'preferred')
  mkdirSync(preferred)
  writeFileSync(join(preferred, 'other-user-work'), 'keep')
  const created = createTempDir('oats-created-', { preferred, fallback: dir })
  t.after(() => rmSync(created, { recursive: true, force: true }))
  assert.equal(dirname(created), preferred)
  assert.equal(readFileSync(join(preferred, 'other-user-work'), 'utf8'), 'keep')
})

test('the harness creates its isolated tree under the fallback when preferred is absent', t => {
  const dir = temporary(t)
  const preferred = join(dir, 'absent')
  const fallback = join(dir, 'fallback')
  mkdirSync(fallback)
  const isolated = createIsolatedRoot('oats-isolated-', { preferred, fallback })
  const root = isolated.root
  t.after(() => rmSync(root, { recursive: true, force: true }))
  assert.equal(dirname(root), fallback)
  assert.equal(existsSync(preferred), false)
  assert.ok(existsSync(join(root, 'home')))
  assert.ok(existsSync(join(root, 'project')))
})
