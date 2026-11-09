import { Given } from '@cucumber/cucumber'
import { loadRepositoryManifest } from '../manifest_helper.js'

Given('the repository manifest is loaded', function () {
  this.repository_manifest = loadRepositoryManifest()
})
