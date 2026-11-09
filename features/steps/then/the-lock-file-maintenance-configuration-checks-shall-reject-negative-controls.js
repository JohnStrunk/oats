import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { checkLockFileMaintenance } from '../lock_file_maintenance_helper.js'

// The in-memory baseline is the real configuration: the sanity check fails
// while the repository is in the red phase, and the mutations below prove
// the checks detect regressions once it passes.
Then('the lock file maintenance configuration checks shall reject negative controls', function () {
  checkLockFileMaintenance(this.renovate_config)
  const mutate = change => {
    const config = structuredClone(this.renovate_config)
    change(config.lockFileMaintenance, config)
    return config
  }

  // Missing, disabled, and non-boolean enablement are rejected.
  assert.throws(() => checkLockFileMaintenance(mutate((_maintenance, config) => { delete config.lockFileMaintenance })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { delete maintenance.enabled })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.enabled = false })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.enabled = 'true' })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.enabled = 1 })))

  // A schedule that is not an array of non-empty strings is rejected.
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = 'before 9am on monday' })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = [''] })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = ['   '] })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = ['before 9am on monday', 5] })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = [null] })))
  assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = { when: 'weekly' } })))

  // Renovate's default weekly schedule is acceptable: a missing or reset
  // schedule, an empty array, and any array of non-empty strings.
  assert.doesNotThrow(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = null })))
  assert.doesNotThrow(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = [] })))
  assert.doesNotThrow(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.schedule = ['before 5am on monday'] })))

  // Property: a schedule entry is valid exactly when it is a non-blank
  // string.
  fc.assert(fc.property(fc.string(), entry => {
    const config = mutate(maintenance => { maintenance.schedule = [entry] })
    if (entry.trim() === '') assert.throws(() => checkLockFileMaintenance(config))
    else assert.doesNotThrow(() => checkLockFileMaintenance(config))
  }))
  // Property: only the boolean true enables maintenance.
  fc.assert(fc.property(fc.anything().filter(value => value !== true), value => {
    assert.throws(() => checkLockFileMaintenance(mutate(maintenance => { maintenance.enabled = value })))
  }))
})
