import assert from 'node:assert/strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { launchSidebar, stopSidebar } from '../steps/sidebar_lifecycle_helper.js'
import { createSidebarTemp } from '../steps/sidebar_temp_helper.js'

async function fixture() {
  const sidebarTemp = await createSidebarTemp('oats-sidebar-lifecycle-')
  await writeFile(path.join(sidebarTemp, 'control.json'), 'fixture')
  return { sidebarTemp }
}

test('failed startup retains adapter and control across repeated cleanup', async () => {
  const world = await fixture()
  const directory = world.sidebarTemp
  try {
    await assert.rejects(launchSidebar(world, async () => { throw new Error('launch failure') }), /launch failure.*retained/)
    for (let i = 0; i < 2; i++) {
      await assert.rejects(stopSidebar(world), /cleanup unconfirmed/)
      assert.equal(await readFile(path.join(directory, 'control.json'), 'utf8'), 'fixture')
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('failed close retains the PTY handle and files across repeated cleanup', async () => {
  const world = await fixture()
  const directory = world.sidebarTemp
  let attempts = 0
  const pty = { close: async () => { attempts++; throw new Error('cleanup unconfirmed') } }
  try {
    await launchSidebar(world, async () => pty)
    for (let i = 0; i < 2; i++) {
      await assert.rejects(stopSidebar(world), /cleanup unconfirmed/)
      assert.equal(world.sidebarPty, pty)
      assert.equal(await readFile(path.join(directory, 'control.json'), 'utf8'), 'fixture')
    }
    assert.equal(attempts, 2)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('confirmed close removes the scenario directory', async () => {
  const world = await fixture()
  const directory = world.sidebarTemp
  let closed = false
  await launchSidebar(world, async () => ({ close: async () => { closed = true } }))
  await stopSidebar(world)
  assert.equal(closed, true)
  assert.equal(world.sidebarPty, null)
  assert.equal(world.sidebarTemp, null)
  await assert.rejects(readFile(path.join(directory, 'control.json')), { code: 'ENOENT' })
})

test('pre-launch setup failure leaves no process to clean up', async () => {
  const world = await fixture()
  const directory = world.sidebarTemp
  await stopSidebar(world)
  await assert.rejects(readFile(path.join(directory, 'control.json')), { code: 'ENOENT' })
})
