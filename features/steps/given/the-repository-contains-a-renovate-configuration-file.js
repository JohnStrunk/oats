import { Given } from '@cucumber/cucumber'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository contains a Renovate configuration file', function () {
  const path = join(getRepoRoot(), '.github/renovate.json5')
  this.renovate_config_path = existsSync(path) ? path : join(getRepoRoot(), '.github/renovate.json')
})
