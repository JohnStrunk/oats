import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getRepoRoot } from '../workflow_helper.js'
import { join } from 'node:path'

Then('the CI test job shall run the real-host contract test with the installed pinned host', function () {
  const job = this.ci_workflow.jobs?.test
  assert(job && Array.isArray(job.steps), 'CI test job and steps are required')
  assert(!job.if && !job['continue-on-error'], 'CI must not skip or ignore the test job')
  const steps = job.steps
  const setup = steps.findIndex(step => step.uses?.startsWith('actions/setup-node@') && String(step.with?.['node-version']) === '26')
  const install = steps.findIndex(step => step.run?.trim() === 'npm ci --prefix .github/tooling/opencode-host')
  const run = steps.findIndex(step => step.run?.trim() === 'npm run test:real-host')
  assert(setup >= 0 && install > setup && run > install, 'Node 26 and pinned host installation must precede the real-host test')
  for (const index of [setup, install, run]) {
    assert(!steps[index].if && !steps[index]['continue-on-error'], 'Required test steps must not be conditional or allowed to fail')
  }
  assert.equal(steps[run].env?.OATS_OPENCODE, '${{ github.workspace }}/.github/tooling/opencode-host/node_modules/.bin/opencode')
  const hostPackage = JSON.parse(readFileSync(join(getRepoRoot(), '.github/tooling/opencode-host/package.json'), 'utf8'))
  assert.equal(hostPackage.dependencies['@opencode/cli'], '2.0.32')
})
