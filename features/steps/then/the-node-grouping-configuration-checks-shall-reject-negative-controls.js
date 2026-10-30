import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { checkNodeGroupNoMajorMinorSplit, checkNodeGroupScope } from '../node_grouping_helper.js'

Then('the Node grouping configuration checks shall reject negative controls', function () {
  // This in-memory baseline isolates the controls even during the red phase;
  // the separate scenario checks the real configuration's split setting.
  const baseline = structuredClone(this.renovate_config)
  const baselineRule = baseline.packageRules.find(candidate =>
    candidate.groupName && candidate.matchManagers?.includes('nvm') &&
    candidate.matchManagers?.includes('github-actions'))
  assert.ok(baselineRule, 'Expected a Node grouping rule before mutation')
  baselineRule.separateMajorMinor = false
  baselineRule.matchDatasources = ['node-version', 'github-releases']
  checkNodeGroupScope(baseline)
  checkNodeGroupNoMajorMinorSplit(baseline)
  const mutate = change => {
    const config = structuredClone(baseline)
    const rule = config.packageRules.find(candidate =>
      candidate.groupName && candidate.matchManagers?.includes('nvm') &&
      candidate.matchManagers?.includes('github-actions'))
    assert.ok(rule, 'Expected a Node grouping rule before mutation')
    change(rule, config)
    return config
  }
  assert.throws(() => checkNodeGroupScope(mutate(rule => { delete rule.groupName })))
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchManagers = ['github-actions'] })))
  assert.throws(() => checkNodeGroupScope(mutate(rule => { delete rule.matchDatasources })),
    /docker:\/\/node:26 action image must not match/)
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchDatasources.push('docker') })),
    /docker:\/\/node:26 action image must not match/)
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchDatasources = ['node-version'] })),
    /setup-node input dependency must match/)
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchDatasources = ['github-releases'] })),
    /\.nvmrc Node dependency must match/)
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchDatasources.push('*') })),
    /Only literal datasource matchers can be verified/)
  assert.throws(() => checkNodeGroupScope(mutate(rule => {
    delete rule.matchDepNames
    delete rule.matchPackageNames
  })))
  assert.throws(() => checkNodeGroupScope(mutate((_rule, config) => {
    config.nvm = { enabled: false }
  })))
  assert.throws(() => checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], groupName: 'Other Node updates' })
  })))
  assert.throws(() => checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], enabled: false })
  })))
  assert.throws(() => checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], matchDatasources: ['NODE-VERSION'], enabled: false })
  })))
  assert.throws(() => checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], matchDatasources: ['{docker,node-version}'], enabled: false })
  })))
  // A manager that is provably disjoint should not block unrelated rules.
  checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['npm'], groupName: 'npm updates', enabled: false })
  }))
  // A Docker-only rule is also disjoint, even for the same manager and name.
  checkNodeGroupScope(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['github-actions'], matchDatasources: ['docker'], matchPackageNames: ['node'], groupName: 'Docker images', enabled: false })
  }))
  assert.throws(() => checkNodeGroupScope(mutate(rule => { rule.matchManagers.push('npm') })))
  assert.throws(() => checkNodeGroupScope(mutate(rule => {
    if (rule.matchPackageNames) rule.matchPackageNames.push('actions/checkout')
    else rule.matchDepNames.push('actions/checkout')
  })))
  assert.throws(() => checkNodeGroupScope(mutate(rule => {
    if (rule.matchPackageNames) rule.matchPackageNames = ['node']
    else rule.matchDepNames = ['actions/setup-node']
  })))
  assert.throws(() => checkNodeGroupNoMajorMinorSplit(mutate(rule => { delete rule.separateMajorMinor })))
  assert.throws(() => checkNodeGroupNoMajorMinorSplit(mutate(rule => { rule.separateMajorMinor = true })))
  assert.doesNotThrow(() => checkNodeGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['npm'], separateMajorMinor: true })
  })))
  assert.doesNotThrow(() => checkNodeGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['github-actions'], matchDatasources: ['docker'], separateMajorMinor: true })
  })))
  assert.throws(() => checkNodeGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['github-actions'], matchDatasources: ['github-releases'], matchDepNames: ['node'], matchPackageNames: ['actions/node-versions'], separateMajorMinor: true })
  })), /later local package rule may override the Node grouping split setting/)
  assert.throws(() => checkNodeGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['nvm'], matchDatasources: ['node-version'], matchDepNames: ['node'], matchPackageNames: ['node'], separateMajorMinor: true })
  })), /later local package rule may override the Node grouping split setting/)
  assert.throws(() => checkNodeGroupNoMajorMinorSplit(mutate((_rule, config) => {
    config.packageRules.push({ matchManagers: ['*'], separateMajorMinor: true })
  })), /later local package rule may override the Node grouping split setting/)
})
