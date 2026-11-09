import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { checkOpentuiVersionCap, findOpentuiCapRule } from '../opencode_stack_helper.js'

// The in-memory baseline is the real configuration: the sanity check fails
// while the repository is in the red phase, and the mutations below prove
// the checks detect regressions once it passes.
Then('the OpenTUI version cap configuration checks shall reject negative controls', function () {
  checkOpentuiVersionCap(this.renovate_config)
  const mutate = change => {
    const config = structuredClone(this.renovate_config)
    const rule = findOpentuiCapRule(config)
    assert.ok(rule, 'Expected an OpenTUI version cap rule before mutation')
    change(rule, config)
    return config
  }

  // Missing caps, wrong version lines, and widened or unverifiable package
  // patterns are rejected.
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { delete rule.allowedVersions })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.allowedVersions = '0.8.x' })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.allowedVersions = '^0.7.0' })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.allowedVersions = '>=0.7.0 <0.8.0' })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.matchPackageNames = ['@opentui/**', '@opencode/**'] })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.matchPackageNames = ['**'] })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.matchPackageNames = ['@opencode/**'] })))
  assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.matchCategories = ['docker'] })))

  // A second cap that may match an OpenTUI package is rejected, while caps
  // for provably unrelated packages stay allowed.
  assert.throws(() => checkOpentuiVersionCap(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@opentui/core'], allowedVersions: '0.8.0' })
  })))
  assert.doesNotThrow(() => checkOpentuiVersionCap(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['yaml'], allowedVersions: '2.x' })
  })))

  // Property: any cap version other than the 0.7.x line is rejected.
  fc.assert(fc.property(fc.string().filter(value => value !== '0.7.x'), version => {
    assert.throws(() => checkOpentuiVersionCap(mutate(rule => { rule.allowedVersions = version })))
  }))
  // Property: widening the cap to any OpenCode scope package is rejected.
  fc.assert(fc.property(fc.constantFrom('@opencode/plugin', '@opencode/client', '@opencode/cli'), packageName => {
    assert.throws(() => checkOpentuiVersionCap(mutate(rule => {
      rule.matchPackageNames = ['@opentui/**', packageName]
    })))
  }))
})
