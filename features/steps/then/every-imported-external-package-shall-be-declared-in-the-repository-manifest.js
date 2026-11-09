import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { checkManifestDeclaresPackages } from '../manifest_helper.js'

Then('every imported external package shall be declared in the repository manifest', function () {
  assert.ok(Array.isArray(this.source_imports) && this.source_imports.length > 0,
    'Expected a completed repository source scan')
  checkManifestDeclaresPackages(this.repository_manifest, this.source_imports)
})
