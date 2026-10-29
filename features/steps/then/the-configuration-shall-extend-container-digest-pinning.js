import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the configuration shall extend container digest pinning', function () {
  const extensions = this.renovate_config?.extends ?? []
  assert(extensions.includes('docker:pinDigests'), `Expected 'docker:pinDigests' in extends: ${extensions}`)
})
