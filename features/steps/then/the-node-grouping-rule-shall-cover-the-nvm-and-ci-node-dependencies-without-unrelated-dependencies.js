import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { checkNodeGroupScope } from '../node_grouping_helper.js'

// Deliberately checks only literal matchers: this is not a Renovate simulator.
// Reject unsupported matchers rather than guessing at their effect.
Then('the Node grouping rule shall cover the nvm and CI Node dependencies without unrelated dependencies', function () {
  assert.match(this.nvmNodeVersion, /^v?\d+(?:\.\d+){0,2}$/, 'Expected a concrete .nvmrc Node version')
  assert.ok(this.ciNodeVersions.length, 'Expected at least one CI setup-node input')
  for (const { job, version } of this.ciNodeVersions) {
    assert.match(String(version), /^v?\d+(?:\.\d+){0,2}$/, `Expected a concrete Node version in CI job ${job}`)
  }
  checkNodeGroupScope(this.renovate_config)
})
