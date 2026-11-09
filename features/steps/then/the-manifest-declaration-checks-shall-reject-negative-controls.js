import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { builtinModules } from 'node:module'
import { checkManifestDeclaresPackages, removeDeclaration } from '../manifest_helper.js'
import { extractImportSpecifiers, reduceToPackageName } from '../source_import_scanner.js'

// The in-memory baseline is the real manifest: the sanity check fails while
// the repository is in the red phase, and the mutations below prove the
// checks detect regressions once it passes.
Then('the manifest declaration checks shall reject negative controls', function () {
  checkManifestDeclaresPackages(this.repository_manifest, this.source_imports)
  const scanned = [...new Set(this.source_imports
    .map(({ specifier }) => reduceToPackageName(specifier))
    .filter(packageName => packageName !== null))]
  assert.ok(scanned.length > 0, 'Expected the scan to find imported packages')
  const mutate = change => {
    const manifest = structuredClone(this.repository_manifest)
    change(manifest)
    return manifest
  }

  // Property: dropping any single declaration of a scanned package is
  // detected, wherever in the dependency maps it is declared.
  fc.assert(fc.property(fc.constantFrom(...scanned), packageName => {
    assert.throws(() => checkManifestDeclaresPackages(
      mutate(manifest => removeDeclaration(manifest, packageName)), this.source_imports))
  }))

  // The overrides section is not a declaration source.
  assert.throws(() => checkManifestDeclaresPackages(mutate(manifest => {
    removeDeclaration(manifest, 'solid-js')
    manifest.overrides = { '@opentui/solid': { 'solid-js': '1.9.18' } }
  }), this.source_imports))

  // Specifier reduction ignores relative paths, aliases, and built-ins. The
  // bare names below are module.builtinModules entries; a prefix-only module
  // such as node:test is ignored through its node: prefix instead.
  for (const specifier of ['./helper.js', '../steps/helper.js', '/helper.js', '#internal',
    'node:fs', 'node:test', 'fs', 'path', 'child_process', 'os', 'util', 'url', 'assert', 'module']) {
    assert.equal(reduceToPackageName(specifier), null, `${specifier} must not reduce to a package`)
  }

  // Property: scoped specifiers reduce to their first two segments and
  // unscoped ones to their first segment.
  const unscopedName = fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter(name => !builtinModules.includes(name))
  const pathSegment = fc.stringMatching(/^[a-z][a-z0-9._-]*(?:\/[a-z][a-z0-9._-]*)*/)
  fc.assert(fc.property(unscopedName, unscopedName, pathSegment, (scope, name, path) => {
    assert.equal(reduceToPackageName(`@${scope}/${name}/${path}`), `@${scope}/${name}`)
  }))
  fc.assert(fc.property(unscopedName, pathSegment, (name, path) => {
    assert.equal(reduceToPackageName(`${name}/${path}`), name)
  }))

  // Extraction matches import syntax positions only. The synthetic sources
  // below use escaped quotes so that this file's own text cannot match the
  // scan patterns when the repository is scanned.
  fc.assert(fc.property(unscopedName, packageName => {
    for (const source of [
      `import value from \u0027${packageName}\u0027`,
      `import \u0027${packageName}\u0027`,
      `export { value } from \u0027${packageName}\u0027`,
      `await import(\u0027${packageName}\u0027)`,
      `require(\u0027${packageName}\u0027)`,
    ]) {
      assert.deepEqual(extractImportSpecifiers(source), [packageName])
    }
  }))
  // Prose and comments that merely mention the keywords are not imports.
  assert.deepEqual(extractImportSpecifiers(`const note = \u0027mentions import and from and require\u0027`), [])
  assert.deepEqual(extractImportSpecifiers(`// see the import of \u0027left-pad\u0027 here`), [])
  assert.deepEqual(extractImportSpecifiers(`// call import(\u0027left-pad\u0027) indirectly`), [])
})
