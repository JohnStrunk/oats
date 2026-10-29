import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
When('the CI workflow executes the YAML and workflow linter', function () {
  const jobs = Object.values(loadCiWorkflow().jobs ?? {}).map(job => JSON.stringify(job).toLowerCase())
  assert(jobs.some(job => job.includes('actionlint')), 'No actionlint configuration found in CI workflow jobs')
  assert(jobs.some(job => job.includes('yamllint')), 'No yamllint configuration found in CI workflow jobs')
  this.yaml_linter_executed = true
})
