import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getRepoRoot } from '../workflow_helper.js'
import { checkNodeVersions } from '../node_version_helper.js'
import { join } from 'node:path'

Then('the CI test job shall run the real-host contract test with the installed pinned host', function () {
  const job = this.ci_workflow.jobs?.test
  assert(job && Array.isArray(job.steps), 'CI test job and steps are required')
  assert(!job.if && !job['continue-on-error'], 'CI must not skip or ignore the test job')
  const steps = job.steps
  const setup = steps.findIndex(step => step.uses?.startsWith('actions/setup-node@'))
  const install = steps.findIndex(step => step.run?.trim() === 'npm ci --prefix .github/tooling/opencode-host')
  const run = steps.findIndex(step => step.run?.trim() === 'npm run test:real-host')
  assert(setup >= 0 && install > setup && run > install, 'Node setup and pinned host installation must precede the real-host test')
  checkNodeVersions(this.nvmNodeVersion, [{ job: 'test', version: steps[setup].with?.['node-version'] }])
  for (const index of [setup, install, run]) {
    assert(!steps[index].if && !steps[index]['continue-on-error'], 'Required test steps must not be conditional or allowed to fail')
  }
  assert(!Object.hasOwn(steps[setup], 'shell'), 'Node setup action must not specify a shell')
  for (const index of [install, run]) {
    // GitHub resolves step, job, then workflow defaults. Reject arbitrary
    // command templates, which can exit successfully without running {0}.
    // This conservative check also rejects valid templates other than bash/sh.
    const shellScope = [steps[index], job.defaults?.run, this.ci_workflow.defaults?.run]
      .find(scope => scope && Object.hasOwn(scope, 'shell'))
    assert(!shellScope || ['bash', 'sh'].includes(shellScope.shell), 'Required test steps must use a supported shell')
  }
  assert.equal(steps[run].env?.OATS_OPENCODE, '${{ github.workspace }}/.github/tooling/opencode-host/node_modules/.bin/opencode')
  const hostPackage = JSON.parse(readFileSync(join(getRepoRoot(), '.github/tooling/opencode-host/package.json'), 'utf8'))
  assert.equal(hostPackage.dependencies['@opencode/cli'], '2.0.32')
})
