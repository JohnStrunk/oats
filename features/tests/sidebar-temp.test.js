import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { createSidebarTemp, sidebarTempRoot } from '../steps/sidebar_temp_helper.js'

test('sidebar fixtures fall back when the preferred directory does not exist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oats-sidebar-root-test-'))
  try {
    const fallback = join(root, 'fallback')
    await mkdir(fallback)
    const preferred = join(root, 'missing')
    const directory = await createSidebarTemp('fixture-', { preferred, fallback })
    assert.equal(dirname(directory), fallback)
    assert.match(basename(directory), /^fixture-/)
    assert.ok((await stat(directory)).isDirectory())
    await assert.rejects(stat(preferred), { code: 'ENOENT' })
    assert.equal(sidebarTempRoot({ preferred }), tmpdir())
    const osDirectory = await createSidebarTemp('oats-sidebar-fallback-test-', { preferred })
    try { assert.equal(dirname(osDirectory), tmpdir()) }
    finally { await rm(osDirectory, { recursive: true, force: true }) }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('sidebar fixtures prefer an existing directory and ignore a non-directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oats-sidebar-root-test-'))
  try {
    const fallback = join(root, 'fallback')
    const preferred = join(root, 'preferred')
    await mkdir(fallback)
    await mkdir(preferred)
    assert.equal(sidebarTempRoot({ preferred, fallback }), preferred)
    const directory = await createSidebarTemp('fixture-', { preferred, fallback })
    assert.equal(dirname(directory), preferred)
    const file = join(root, 'file')
    await writeFile(file, 'not a directory')
    assert.equal(sidebarTempRoot({ preferred: file, fallback }), fallback)
  } finally { await rm(root, { recursive: true, force: true }) }
})
