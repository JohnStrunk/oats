// Single source of truth for the real-host contract gate. `run.js` executes
// every suite; focused runners import the matching descriptor so a test rename
// cannot silently make the gate expect the wrong test name.
export const SESSION_DATA_SUITE = Object.freeze({
  file: 'session-data-access.real-host.test.js',
  name: 'session data access follows the pinned OpenCode session tree',
})

export const SIDEBAR_SUITE = Object.freeze({
  file: 'plugin-sidebar.real-host.test.js',
  name: 'the real pinned OpenCode TUI renders and toggles the actual OATS Agent stats sidebar',
})

export const REQUIRED_REAL_HOST_SUITES = Object.freeze([
  SESSION_DATA_SUITE,
  SIDEBAR_SUITE,
])
