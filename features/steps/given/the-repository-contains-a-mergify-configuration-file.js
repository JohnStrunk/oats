import { Given } from '@cucumber/cucumber'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository contains a Mergify configuration file', function () { this.mergify_config_path = join(getRepoRoot(), '.github/mergify.yml') })
