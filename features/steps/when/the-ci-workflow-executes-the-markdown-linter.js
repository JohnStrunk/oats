import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
When('the CI workflow executes the markdown linter', function () {
  const jobs = loadCiWorkflow().jobs ?? {}
  assert(Object.values(jobs).some(job => JSON.stringify(job).toLowerCase().includes('markdownlint')), 'No job or step configuring markdownlint found in CI workflow')
  this.markdown_linter_executed = true
})
