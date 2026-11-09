// Checks the root package manifest. The manifest is the declaration surface
// for every external package the repository's own code imports, and the pin
// surface for the version-coupled OpenCode family.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExactRelease } from './host_pin_helper.js'
import { reduceToPackageName } from './source_import_scanner.js'

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const DEPENDENCY_MAPS = ['dependencies', 'devDependencies', 'peerDependencies']
const OPENCODE_PLUGIN = '@opencode/plugin'
const OPENCODE_CLIENT = '@opencode/client'

export function loadRepositoryManifest() {
  const path = join(REPO_ROOT, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  assert.ok(manifest && typeof manifest === 'object' && !Array.isArray(manifest), `Expected an object in ${path}`)
  return manifest
}

// Only the top-level dependency maps declare packages. The nested pin in the
// overrides section (for example the solid-js pin under @opentui/solid)
// constrains how nested dependencies install; it is not a declaration.
export function declaredPackages(manifest) {
  return new Set(DEPENDENCY_MAPS.flatMap(map => Object.keys(manifest[map] ?? {})))
}

function declaredVersions(manifest, packageName) {
  return DEPENDENCY_MAPS.flatMap(map => {
    const version = manifest[map]?.[packageName]
    return version === undefined ? [] : [version]
  })
}

export function removeDeclaration(manifest, packageName) {
  for (const map of DEPENDENCY_MAPS) {
    if (manifest[map]) delete manifest[map][packageName]
  }
}

export function checkManifestDeclaresPackages(manifest, imports) {
  assert.ok(manifest && typeof manifest === 'object' && !Array.isArray(manifest),
    'Expected a parsed repository manifest')
  const declared = declaredPackages(manifest)
  assert.ok(declared.size > 0, 'Expected the manifest to declare at least one package')
  const missing = new Map()
  for (const { file, specifier } of imports) {
    const packageName = reduceToPackageName(specifier)
    if (packageName === null || declared.has(packageName)) continue
    if (!missing.has(packageName)) missing.set(packageName, new Set())
    missing.get(packageName).add(`${file} (${specifier})`)
  }
  assert.equal(missing.size, 0,
    `Imported packages missing from the manifest: ${[...missing.entries()]
      .map(([packageName, importedBy]) => `${packageName} imported by ${[...importedBy].sort().join(', ')}`)
      .join('; ')}`)
}

// Both declarations must carry the same exact release pin. A range or a
// mismatched pin would let the client drift from the plugin line, and the
// client API the real-host tests exercise would no longer match it.
export function checkOpencodeClientPin(manifest) {
  const pluginVersions = declaredVersions(manifest, OPENCODE_PLUGIN)
  const clientVersions = declaredVersions(manifest, OPENCODE_CLIENT)
  for (const [packageName, versions] of [[OPENCODE_PLUGIN, pluginVersions], [OPENCODE_CLIENT, clientVersions]]) {
    assert.ok(versions.length > 0, `The manifest must declare ${packageName}`)
    for (const version of versions) {
      assert.ok(isExactRelease(version),
        `The ${packageName} declaration must be an exact release pin, got ${JSON.stringify(version)}`)
    }
    assert.equal(new Set(versions).size, 1, `Every ${packageName} declaration must carry the same version`)
  }
  assert.equal(clientVersions[0], pluginVersions[0],
    `The ${OPENCODE_CLIENT} pin must equal the ${OPENCODE_PLUGIN} pin`)
}
