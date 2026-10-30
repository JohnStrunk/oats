import { When } from '@cucumber/cucumber'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { getRepoRoot } from '../workflow_helper.js'

When('the repository Node version declarations are inspected', function () {
  const root = getRepoRoot()
  this.nvmNodeVersion = readFileSync(join(root, '.nvmrc'), 'utf8').trim()
  const workflow = YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'))
  this.ciNodeVersions = Object.entries(workflow.jobs ?? {}).flatMap(([job, config]) =>
    (config.steps ?? [])
      .filter(step => /^actions\/setup-node@/.test(step.uses ?? ''))
      .map(step => ({ job, version: step.with?.['node-version'] })),
  )
})
