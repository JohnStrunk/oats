import { When } from '@cucumber/cucumber'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRepoRoot } from '../workflow_helper.js'

When('the repository host pin and supported host documentation are consulted', function () {
  const root = getRepoRoot()
  this.documented_host_pin = JSON.parse(readFileSync(join(root, '.github/tooling/opencode-host/package.json'), 'utf8')).dependencies['@opencode/cli']
  this.supported_host_docs = ['Architecture.md', 'README.md'].map(name => ({
    name,
    text: readFileSync(join(root, name), 'utf8'),
  }))
})
