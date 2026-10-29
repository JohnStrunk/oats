import { Given } from '@cucumber/cucumber'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository contains YAML files and GitHub Actions workflow definitions', function () { this.workflow_dir = join(getRepoRoot(), '.github/workflows') })
