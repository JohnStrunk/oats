import { Given } from '@cucumber/cucumber'
import { globSync } from 'node:fs'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository contains executable shell scripts', function () { this.shell_files = globSync('**/*.sh', { cwd: getRepoRoot() }) })
