// Checks the Renovate lock file maintenance declaration. Periodic lock file
// maintenance keeps the committed lock file resolvable without unrelated
// version changes, which is what lets the version-coupled OpenCode and
// OpenTUI family stay installable. This inspects the local configuration
// only; it cannot observe an actual Renovate maintenance run.

import assert from 'node:assert/strict'

export function checkLockFileMaintenance(config) {
  const maintenance = config.lockFileMaintenance
  assert.ok(maintenance && typeof maintenance === 'object' && !Array.isArray(maintenance),
    'Expected a lockFileMaintenance object in the Renovate configuration')
  assert.equal(maintenance.enabled, true, 'Lock file maintenance must be enabled')
  // A missing schedule, or an explicit null reset, uses Renovate's default
  // weekly schedule, which is acceptable.
  const schedule = maintenance.schedule
  if (schedule === undefined || schedule === null) return
  assert.ok(Array.isArray(schedule), 'The lock file maintenance schedule must be an array')
  for (const entry of schedule) {
    assert.ok(typeof entry === 'string' && entry.trim(),
      'Every lock file maintenance schedule entry must be a non-empty string')
  }
}
