// Checks for the version-coupled OpenCode and OpenTUI Renovate rules.
//
// `@opencode/plugin` pins exact optional OpenTUI peers and `@opentui/solid`
// depends on the same `@opentui/core` version, so the @opencode and @opentui
// packages form one version-coupled family: their updates must be proposed
// together, and OpenTUI updates must stay on a peer-compatible line. These
// checks inspect the local Renovate configuration only; they are not a
// Renovate simulator.

import assert from 'node:assert/strict'
import fc from 'fast-check'

const OPENCODE_PATTERN = '@opencode/**'
const OPENTUI_PATTERN = '@opentui/**'

// Extraction identities of the coupled family, not a live dependency scan:
// the plugin and client are declared by the root manifest, the host by the
// pinned host tooling manifest, and the OpenTUI packages by the plugin peers.
export const STACK_PACKAGE_NAMES = [
  '@opencode/plugin',
  '@opencode/client',
  '@opencode/cli',
  '@opentui/core',
  '@opentui/solid',
]
const OPENCODE_PACKAGES = STACK_PACKAGE_NAMES.filter(name => name.startsWith('@opencode/'))
const OPENTUI_PACKAGES = STACK_PACKAGE_NAMES.filter(name => name.startsWith('@opentui/'))

// A literal `@scope/**` pattern matches exactly the package names inside
// that npm scope: it requires the scope prefix followed by a slash, so it
// cannot match `@opencode-foo` (a different scope) or `opencode` (unscoped).
// The glob semantics are implemented here; other pattern forms are rejected
// instead of guessed at.
function scopedPatternScope(pattern) {
  if (typeof pattern !== 'string') return undefined
  return /^(@[\w.-]+)\/\*\*$/.exec(pattern)?.[1]
}

export function scopedPatternMatches(pattern, name) {
  const scope = scopedPatternScope(pattern)
  return scope !== undefined && name.startsWith(`${scope}/`)
}

// Conservative name matching for arbitrary local rules: only literal names
// and `@scope/**` globs can be proved disjoint. Regex, negation, and other
// glob forms are treated as potential matches.
function patternMayMatch(pattern, name) {
  if (typeof pattern !== 'string') return true
  const scope = scopedPatternScope(pattern)
  if (scope !== undefined) return name.startsWith(`${scope}/`)
  if (/^[\w@/.-]+$/.test(pattern)) return pattern.toLowerCase() === name.toLowerCase()
  return true
}

// Name fields whose literal values can be verified. Pattern-based name
// fields cannot be verified and make a rule a potential match.
const VERIFIED_NAME_MATCHERS = ['matchPackageNames', 'matchDepNames']
const NAME_PATTERN_MATCHERS = ['matchPackagePatterns', 'matchDepNamePatterns']

// Whether a local package rule may match one stack package. A rule is proved
// disjoint only when every present verified name list provably excludes the
// package: that is safe under both AND and OR semantics between the name
// fields, and other matcher dimensions can only restrict a rule further.
function ruleMayMatchStackPackage(rule, packageName) {
  if (!rule || typeof rule !== 'object') return true
  if (NAME_PATTERN_MATCHERS.some(key => rule[key] !== undefined)) return true
  let hasNameList = false
  let excludes = true
  for (const key of VERIFIED_NAME_MATCHERS) {
    const values = rule[key]
    if (values === undefined) continue
    if (!Array.isArray(values)) return true
    hasNameList = true
    if (values.some(pattern => patternMayMatch(pattern, packageName))) excludes = false
  }
  return !(hasNameList && excludes)
}

export function findStackGroupRule(config) {
  return (config.packageRules ?? []).find(candidate =>
    typeof candidate?.groupName === 'string' && candidate.groupName.trim() &&
    Array.isArray(candidate?.matchPackageNames) &&
    candidate.matchPackageNames.includes(OPENCODE_PATTERN) &&
    candidate.matchPackageNames.includes(OPENTUI_PATTERN))
}

export function checkStackGroupScope(config) {
  const rules = config.packageRules ?? []
  const rule = findStackGroupRule(config)
  assert.ok(rule, 'Expected a grouped package rule for the @opencode and @opentui scopes')
  assert.equal(typeof rule.groupName, 'string')
  assert.ok(rule.groupName.trim(), 'The group name must not be empty')

  // Only the mandated scoped name patterns can be verified; reject other
  // matcher keys instead of guessing at their effect.
  const supported = new Set(['matchPackageNames'])
  for (const key of Object.keys(rule)) {
    if (key.startsWith('match')) assert.ok(supported.has(key), `Unverified grouping matcher: ${key}`)
  }
  assert.ok(Array.isArray(rule.matchPackageNames), 'The group must select packages through matchPackageNames')
  assert.deepEqual([...rule.matchPackageNames].sort(), [OPENCODE_PATTERN, OPENTUI_PATTERN],
    'The group must match exactly the @opencode and @opentui scoped patterns')

  const groupMatches = name => rule.matchPackageNames.some(pattern => scopedPatternMatches(pattern, name))
  for (const name of STACK_PACKAGE_NAMES) {
    assert.ok(groupMatches(name), `The ${name} dependency must be in the group`)
  }
  for (const name of ['solid-js', 'yaml', '@cucumber/cucumber', '@opencode-foo', 'opencode']) {
    assert.ok(!groupMatches(name), `The unrelated dependency ${name} must not be in the group`)
  }
  // The scoped pattern semantics are verified as a property so a future edit
  // cannot quietly widen them beyond the two scopes.
  fc.assert(fc.property(fc.string(), name =>
    assert.equal(groupMatches(name), name.startsWith('@opencode/') || name.startsWith('@opentui/'))))

  assert.notEqual(config.enabled, false, 'Renovate must not be disabled')
  assert.notEqual(config.npm?.enabled, false, 'The npm manager must not be disabled')
  assert.notEqual(rule.enabled, false, 'The stack grouping rule must not disable updates')
  assert.equal(rules.filter(candidate => candidate?.groupName === rule.groupName).length, 1,
    'Other local rules must not add dependencies to the stack group')
  for (const candidate of rules) {
    if (candidate === rule) continue
    if (!STACK_PACKAGE_NAMES.some(name => ruleMayMatchStackPackage(candidate, name))) continue
    // Reject potentially applicable regrouping and disables even when a
    // later rule might override them: this is a conservative
    // local-configuration check.
    assert.ok(!Object.hasOwn(candidate, 'groupName'), 'A local package rule may override the stack group')
    assert.notEqual(candidate.enabled, false, 'A local package rule may disable OpenCode stack updates')
  }
}

export function checkStackGroupNoMajorMinorSplit(config) {
  const rules = config.packageRules ?? []
  const rule = findStackGroupRule(config)
  assert.ok(rule, 'Expected a grouped package rule for the @opencode and @opentui scopes')
  assert.equal(rule.separateMajorMinor, false,
    'The stack group must explicitly disable separateMajorMinor')
  const later = rules.slice(rules.indexOf(rule) + 1)
  for (const candidate of later) {
    if (!STACK_PACKAGE_NAMES.some(name => ruleMayMatchStackPackage(candidate, name))) continue
    assert.ok(candidate.separateMajorMinor === undefined || candidate.separateMajorMinor === false,
      'A later local package rule may override the stack grouping split setting')
  }
}

export function findOpentuiCapRule(config) {
  return (config.packageRules ?? []).find(candidate =>
    Array.isArray(candidate?.matchPackageNames) &&
    candidate.matchPackageNames.includes(OPENTUI_PATTERN) &&
    candidate.allowedVersions !== undefined)
}

// This verifies only the configured cap. Whether upstream @opentui releases
// exist, or whether the pinned plugin line accepts other OpenTUI peers,
// cannot be established from the local configuration.
export function checkOpentuiVersionCap(config) {
  const rules = config.packageRules ?? []
  const rule = findOpentuiCapRule(config)
  assert.ok(rule, 'Expected a package rule capping @opentui updates')
  assert.equal(rule.allowedVersions, '0.7.x',
    'The OpenTUI cap must allow only the 0.7.x line')

  const supported = new Set(['matchPackageNames'])
  for (const key of Object.keys(rule)) {
    if (key.startsWith('match')) assert.ok(supported.has(key), `Unverified cap matcher: ${key}`)
  }
  assert.deepEqual(rule.matchPackageNames, [OPENTUI_PATTERN],
    'The cap must select exactly the @opentui scoped pattern')

  const capMatches = name => rule.matchPackageNames.some(pattern => scopedPatternMatches(pattern, name))
  for (const name of OPENTUI_PACKAGES) {
    assert.ok(capMatches(name), `The ${name} dependency must be capped`)
  }
  for (const name of OPENCODE_PACKAGES) {
    assert.ok(!capMatches(name), `The cap must not restrict the OpenCode package ${name}`)
  }
  fc.assert(fc.property(fc.string(), name =>
    assert.equal(capMatches(name), name.startsWith('@opentui/'))))

  // A second local rule carrying allowedVersions that may match an OpenTUI
  // package could override or contradict the cap; reject it conservatively.
  for (const candidate of rules) {
    if (candidate === rule || !Object.hasOwn(candidate, 'allowedVersions')) continue
    assert.ok(!OPENTUI_PACKAGES.some(name => ruleMayMatchStackPackage(candidate, name)),
      'Another local package rule may override the OpenTUI version cap')
  }
}
