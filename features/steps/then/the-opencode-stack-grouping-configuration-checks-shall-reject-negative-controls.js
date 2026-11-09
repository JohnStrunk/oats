import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import {
  checkStackGroupNoMajorMinorSplit,
  checkStackGroupScope,
  findStackGroupRule,
  STACK_PACKAGE_NAMES,
} from '../opencode_stack_helper.js'

// The in-memory baseline is the real configuration: the sanity checks fail
// while the repository is in the red phase, and the mutations below prove
// the checks detect regressions once it passes.
Then('the OpenCode stack grouping configuration checks shall reject negative controls', function () {
  checkStackGroupScope(this.renovate_config)
  checkStackGroupNoMajorMinorSplit(this.renovate_config)
  const mutate = change => {
    const config = structuredClone(this.renovate_config)
    const rule = findStackGroupRule(config)
    assert.ok(rule, 'Expected an OpenCode stack grouping rule before mutation')
    change(rule, config)
    return config
  }

  // Missing or empty group names and missing, widened, or unverifiable
  // package patterns are rejected.
  assert.throws(() => checkStackGroupScope(mutate(rule => { delete rule.groupName })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.groupName = '   ' })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.groupName = 42 })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { delete rule.matchPackageNames })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['@opencode/**'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['@opencode/**', '@opentui/**', 'yaml'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['@opencode/*', '@opentui/**'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['!@opencode/**', '@opentui/**'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['/^@opencode/', '@opentui/**'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchPackageNames = ['**', '@opentui/**'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.matchCategories = ['docker'] })))
  assert.throws(() => checkStackGroupScope(mutate(rule => { rule.enabled = false })))
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => { config.enabled = false })))
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => { config.npm = { enabled: false } })))

  // Local rules that regroup, duplicate, or disable the stack are rejected.
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@opencode/plugin'], groupName: 'Other updates' })
  })))
  assert.throws(() => checkStackGroupScope(mutate((rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@opencode/**', '@opentui/**'], groupName: rule.groupName })
  })), /must not add dependencies/)
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@opentui/**'], enabled: false })
  })))
  // Unverifiable matchers are treated as potential matches.
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchCategories: ['docker'], enabled: false })
  })))
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['*'], enabled: false })
  })))
  assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackagePatterns: ['@opencode/.*'], enabled: false })
  })))
  // Rules provably disjoint from the stack may group or disable other
  // updates, including the existing Node version group shape.
  assert.doesNotThrow(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['yaml'], groupName: 'Yaml updates', enabled: false })
  })))
  assert.doesNotThrow(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@cucumber/**'], groupName: 'Cucumber updates' })
  })))
  assert.doesNotThrow(() => checkStackGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], matchPackageNames: ['node'], groupName: 'Node versions' })
  })))

  // The split setting and its later overrides are checked separately.
  assert.throws(() => checkStackGroupNoMajorMinorSplit(mutate(rule => { delete rule.separateMajorMinor })))
  assert.throws(() => checkStackGroupNoMajorMinorSplit(mutate(rule => { rule.separateMajorMinor = true })))
  assert.throws(() => checkStackGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['@opentui/core'], separateMajorMinor: true })
  })))
  assert.doesNotThrow(() => checkStackGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchPackageNames: ['yaml'], separateMajorMinor: true })
  })))

  // Property: replacing a scoped pattern with any other value is rejected.
  fc.assert(fc.property(fc.string().filter(value => value !== '@opencode/**'), replacement => {
    assert.throws(() => checkStackGroupScope(mutate(rule => {
      rule.matchPackageNames = [replacement, '@opentui/**']
    })))
  }))
  // Property: any local rule that provably matches a stack package may
  // neither regroup it nor disable its updates.
  fc.assert(fc.property(fc.constantFrom(...STACK_PACKAGE_NAMES), fc.string({ minLength: 1 }), (packageName, otherGroup) => {
    assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
      config.packageRules.push({ matchPackageNames: [packageName], groupName: otherGroup })
    })))
    assert.throws(() => checkStackGroupScope(mutate((_rule, config) => {
      config.packageRules.push({ matchPackageNames: [packageName], enabled: false })
    })))
  }))
  // Property: rules scoped to unrelated literal names stay allowed.
  fc.assert(fc.property(fc.stringMatching(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/), name => {
    assert.doesNotThrow(() => checkStackGroupScope(mutate((_rule, config) => {
      config.packageRules.push({ matchPackageNames: [name], groupName: 'Unrelated updates', enabled: false })
    })))
  }))
})
