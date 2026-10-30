import assert from 'node:assert/strict'
import fc from 'fast-check'

function findNodeGroup(config) {
  return (config.packageRules ?? []).find(candidate =>
    candidate.groupName && candidate.matchManagers?.includes('nvm') &&
    candidate.matchManagers?.includes('github-actions'))
}

// Only prove a rule disjoint using literal positive manager/datasource/dependency names.
// Other matchers, including patterns, are conservatively treated as overlapping.
function mayMatchNode(rule) {
  const targets = [
    { manager: 'nvm', datasource: 'node-version', depName: 'node', packageName: 'node' },
    { manager: 'github-actions', datasource: 'github-releases', depName: 'node', packageName: 'actions/node-versions' },
  ]
  const possible = (values, actual) => !Array.isArray(values) || values.some(value =>
    typeof value !== 'string' || !/^[a-zA-Z0-9_.@-]+$/.test(value) || value.toLowerCase() === actual.toLowerCase())
  return targets.some(target =>
    possible(rule.matchManagers, target.manager) &&
    possible(rule.matchDatasources, target.datasource) &&
    possible(rule.matchDepNames, target.depName) &&
    possible(rule.matchPackageNames, target.packageName))
}

export function checkNodeGroupScope(config) {
  const rules = config.packageRules ?? []
  const rule = findNodeGroup(config)
  assert.ok(rule, 'Expected a grouped package rule for both nvm and github-actions')
  assert.equal(typeof rule.groupName, 'string')
  assert.ok(rule.groupName.trim(), 'The group name must not be empty')

  const supported = new Set(['matchManagers', 'matchDatasources', 'matchDepNames', 'matchPackageNames'])
  for (const key of Object.keys(rule)) {
    if (key.startsWith('match')) assert.ok(supported.has(key), `Unverified grouping matcher: ${key}`)
  }
  assert.deepEqual([...rule.matchManagers].sort(), ['github-actions', 'nvm'])
  assert.ok(rule.matchDepNames || rule.matchPackageNames, 'Node dependency matching must be scoped by name')
  if (rule.matchDepNames) assert.deepEqual(rule.matchDepNames, ['node'])
  if (rule.matchPackageNames) {
    assert.deepEqual([...rule.matchPackageNames].sort(), ['actions/node-versions', 'node'])
  }
  if (config.enabledManagers) {
    assert.ok(config.enabledManagers.includes('nvm') && config.enabledManagers.includes('github-actions'))
  }
  assert.notEqual(config.enabled, false, 'Renovate must not be disabled')
  assert.notEqual(config.nvm?.enabled, false, 'The nvm manager must not be disabled')
  assert.notEqual(config['github-actions']?.enabled, false, 'The github-actions manager must not be disabled')
  assert.notEqual(rule.enabled, false, 'The Node grouping rule must not disable updates')
  assert.equal(rules.filter(candidate => candidate.groupName === rule.groupName).length, 1,
    'Other local rules must not add dependencies to the Node group')
  for (const candidate of rules) {
    if (!mayMatchNode(candidate)) continue
    // Reject potentially applicable disables even when a later rule might
    // re-enable them: this is a conservative local-configuration check.
    assert.notEqual(candidate.enabled, false, 'A local package rule may disable Node updates')
  }
  for (const candidate of rules.slice(rules.indexOf(rule) + 1)) {
    if (mayMatchNode(candidate) && Object.hasOwn(candidate, 'groupName')) {
      assert.equal(candidate.groupName, rule.groupName, 'A later local package rule may override the Node group')
    }
  }

  // These are Renovate extraction identities, not a live extraction run. The
  // setup-node input and action reference are separate dependencies; a Docker
  // action such as uses: docker://node:26 has packageName node too.
  // Restrict datasource matching to positive literals so this model cannot
  // mistake a glob, regex, or negation for a non-matching datasource.
  if (rule.matchDatasources) {
    assert.ok(Array.isArray(rule.matchDatasources) && rule.matchDatasources.every(value =>
      typeof value === 'string' && /^[a-z0-9-]+$/.test(value)),
    'Only literal datasource matchers can be verified')
  }
  const matches = ({ manager, datasource, depName, packageName }) =>
    rule.matchManagers.includes(manager) &&
    (!rule.matchDatasources || rule.matchDatasources.includes(datasource)) &&
    (!rule.matchDepNames || rule.matchDepNames.some(name => name.toLowerCase() === depName.toLowerCase())) &&
    (!rule.matchPackageNames || rule.matchPackageNames.some(name => name.toLowerCase() === packageName.toLowerCase()))
  assert.ok(matches({ manager: 'nvm', datasource: 'node-version', depName: 'node', packageName: 'node' }),
    'The .nvmrc Node dependency must match')
  assert.ok(matches({ manager: 'github-actions', datasource: 'github-releases', depName: 'node', packageName: 'actions/node-versions' }),
    'The setup-node input dependency must match')
  assert.ok(!matches({ manager: 'github-actions', datasource: 'docker', depName: 'node', packageName: 'node' }),
    'The docker://node:26 action image must not match')
  assert.ok(!matches({ manager: 'github-actions', datasource: 'github-tags', depName: 'actions/setup-node', packageName: 'actions/setup-node' }))
  assert.ok(!matches({ manager: 'npm', datasource: 'node-version', depName: 'node', packageName: 'node' }))
  fc.assert(fc.property(fc.string({ minLength: 1 }).filter(name => !['node', 'actions/node-versions'].includes(name.toLowerCase())), name =>
    !matches({ manager: 'github-actions', datasource: 'github-releases', depName: name, packageName: name })))
}

export function checkNodeGroupNoMajorMinorSplit(config) {
  const rule = findNodeGroup(config)
  assert.ok(rule, 'Expected a grouped package rule for both nvm and github-actions')
  assert.equal(rule.separateMajorMinor, false,
    'The Node group must explicitly disable separateMajorMinor')
  const laterRules = config.packageRules.slice(config.packageRules.indexOf(rule) + 1)
  assert.ok(laterRules.every(later => !mayMatchNode(later) || later.separateMajorMinor === undefined || later.separateMajorMinor === false),
    'A later local package rule may override the Node grouping split setting')
}
