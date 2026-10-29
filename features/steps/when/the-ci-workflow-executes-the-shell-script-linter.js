import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
When('the CI workflow executes the shell script linter', function () {
  const jobs = loadCiWorkflow().jobs ?? {}
  assert(Object.values(jobs).some(job => JSON.stringify(job).toLowerCase().includes('shellcheck')), 'No shellcheck configuration found in CI workflow jobs')
  this.shell_linter_executed = true
})
