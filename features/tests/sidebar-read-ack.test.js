import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { collapsedWithoutContent } from '../steps/sidebar_section_helper.js'
import { resetSidebarReadAck, waitForSidebarReadAck } from '../steps/sidebar_read_ack_helper.js'
import { createSidebarTemp } from '../steps/sidebar_temp_helper.js'

test('an old collapsed screen and old read cannot acknowledge the new session', async () => {
  const root = await createSidebarTemp('sidebar-read-ack-')
  const control = path.join(root, 'control.json')
  try {
    assert.equal(collapsedWithoutContent(' ▶ Agent stats\n\n'), true)
    await writeFile(`${control}.read`, 'ses_old')
    await assert.rejects(waitForSidebarReadAck(control, 'ses_new', { timeoutMs: 20, pollMs: 1 }), /ses_new.*did not start/)
    await resetSidebarReadAck(control)
    await assert.rejects(waitForSidebarReadAck(control, 'ses_new', { timeoutMs: 20, pollMs: 1 }), /ses_new.*did not start/)
    await writeFile(`${control}.read`, 'ses_new')
    await waitForSidebarReadAck(control, 'ses_new', { timeoutMs: 20, pollMs: 1 })
  } finally { await rm(root, { recursive: true, force: true }) }
})
