import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the configuration shall extend GitHub Actions digest pinning to semantic versions', function () {
  const extensions = this.renovate_config?.extends ?? []
  assert(extensions.includes('helpers:pinGitHubActionDigestsToSemver'), `Expected 'helpers:pinGitHubActionDigestsToSemver' in extends: ${extensions}`)
})
