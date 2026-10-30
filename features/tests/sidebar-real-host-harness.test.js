import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRemoveRoot } from '../real-host-tests/authenticated_server.js'
import { startSidebarTui } from '../real-host-tests/tui_sidebar_harness.js'

// A failed TUI start has no handle to close, so the harness itself must tell the
// shared server fixture to retain its private tree when child cleanup cannot be
// confirmed.

function fakeServer(retained) {
  return {
    root: '/fake/oats-sidebar-root',
    dirs: { project: '/fake/oats-sidebar-root/project' },
    env: {},
    baseUrl: 'http://127.0.0.1:1',
    password: 'not-a-real-password',
    sessions: { sessionID: 'ses_fake_real_host' },
    retainRoot() {
      retained.push(true)
    },
  }
}

test('a shared server root is retained unless cleanup is confirmed and not retained', () => {
  assert.equal(shouldRemoveRoot({ confirmed: true }), true)
  assert.equal(shouldRemoveRoot({ hasSupervisor: false }), true)
  assert.equal(shouldRemoveRoot({ confirmed: false, hasSupervisor: true }), false)
  assert.equal(shouldRemoveRoot({ confirmed: true, retained: true }), false)
  assert.equal(shouldRemoveRoot({ confirmed: true, retain: true }), false)
})

test('failed TUI start retains the shared root when cleanup is unconfirmed', async () => {
  const retained = []
  const server = fakeServer(retained)
  await assert.rejects(
    startSidebarTui({
      executable: '/nonexistent/opencode',
      server,
      pluginPath: null,
      harness: {
        spawnPty: async () => { throw new Error('spawn failed') },
        closeSupervisor: async () => { throw new Error('cleanup unconfirmed') },
      },
    }),
    error => {
      assert.equal(error.cleanupUnconfirmed, true)
      assert.match(error.message, /spawn failed/)
      assert.match(error.message, /cleanup also failed: cleanup unconfirmed/)
      return true
    },
  )
  assert.equal(retained.length, 1, 'the shared server root must be marked retained')
})

test('failed TUI start does not retain the shared root when cleanup succeeds', async () => {
  const retained = []
  const server = fakeServer(retained)
  await assert.rejects(
    startSidebarTui({
      executable: '/nonexistent/opencode',
      server,
      pluginPath: null,
      harness: {
        spawnPty: async () => { throw new Error('spawn failed') },
        closeSupervisor: async () => {},
      },
    }),
    /spawn failed/,
  )
  assert.equal(retained.length, 0)
})
