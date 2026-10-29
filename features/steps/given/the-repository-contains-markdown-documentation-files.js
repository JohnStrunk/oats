import { Given } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { globSync } from 'node:fs'
import { getRepoRoot } from '../workflow_helper.js'
Given('the repository contains markdown documentation files', function () {
  this.markdown_files = globSync(['*.md', 'features/**/*.md'], { cwd: getRepoRoot() })
  assert(this.markdown_files.length > 0, 'No markdown files found in repository')
})
