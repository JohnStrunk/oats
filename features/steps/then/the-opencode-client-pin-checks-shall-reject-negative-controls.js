import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { checkOpencodeClientPin } from '../manifest_helper.js'

const DEPENDENCY_MAPS = ['dependencies', 'devDependencies', 'peerDependencies']

function setDeclaration(manifest, packageName, version) {
  for (const map of DEPENDENCY_MAPS) {
    if (manifest[map] && Object.hasOwn(manifest[map], packageName)) {
      if (version === undefined) delete manifest[map][packageName]
      else manifest[map][packageName] = version
      return
    }
  }
  if (version !== undefined) {
    if (!manifest.dependencies) manifest.dependencies = {}
    manifest.dependencies[packageName] = version
  }
}

// The in-memory baseline is the real manifest: the sanity check fails while
// the repository is in the red phase, and the mutations below prove the
// checks detect regressions once it passes.
Then('the OpenCode client pin checks shall reject negative controls', function () {
  checkOpencodeClientPin(this.repository_manifest)
  const mutate = change => {
    const manifest = structuredClone(this.repository_manifest)
    change(manifest)
    return manifest
  }
  const withClient = version => mutate(manifest => {
    setDeclaration(manifest, '@opencode/client', version)
  })

  // Missing declarations, ranges, and non-release pins are rejected.
  assert.throws(() => checkOpencodeClientPin(withClient(undefined)), /must declare/)
  for (const invalid of ['^2.2.1', '~2.2.1', '2.2.x', '>=2.2.0 <3', '2.2', 'v2.2.1', '2.2.1-beta.1', '02.2.1', 'latest', '']) {
    assert.throws(() => checkOpencodeClientPin(withClient(invalid)), /exact release/)
  }
  assert.throws(() => checkOpencodeClientPin(mutate(manifest => {
    setDeclaration(manifest, '@opencode/plugin', '^2.2.1')
  })), /exact release/)

  // The declaration may live in any top-level dependency map, and
  // conflicting declarations across maps are rejected.
  for (const map of DEPENDENCY_MAPS) {
    const manifest = {}
    manifest[map] = { '@opencode/plugin': '2.2.1', '@opencode/client': '2.2.1' }
    assert.doesNotThrow(() => checkOpencodeClientPin(manifest))
  }
  assert.throws(() => checkOpencodeClientPin({
    dependencies: { '@opencode/plugin': '2.2.1', '@opencode/client': '2.2.1' },
    devDependencies: { '@opencode/plugin': '2.2.2' },
  }), /same version/)
  // Mismatched exact pins are rejected.
  assert.throws(() => checkOpencodeClientPin({
    dependencies: { '@opencode/plugin': '2.2.1', '@opencode/client': '2.2.2' },
  }), /must equal/)

  // Property: two exact pins are accepted exactly when they are equal.
  const exactRelease = fc.tuple(fc.nat(1000), fc.nat(1000), fc.nat(1000)).map(parts => parts.join('.'))
  fc.assert(fc.property(exactRelease, exactRelease, (plugin, client) => {
    const manifest = { dependencies: { '@opencode/plugin': plugin, '@opencode/client': client } }
    if (plugin === client) assert.doesNotThrow(() => checkOpencodeClientPin(manifest))
    else assert.throws(() => checkOpencodeClientPin(manifest))
  }))
  // Property: any client pin other than the plugin pin is rejected.
  fc.assert(fc.property(exactRelease, fc.string(), (plugin, client) => {
    const manifest = { dependencies: { '@opencode/plugin': plugin, '@opencode/client': client } }
    if (client === plugin) assert.doesNotThrow(() => checkOpencodeClientPin(manifest))
    else assert.throws(() => checkOpencodeClientPin(manifest))
  }))
})
