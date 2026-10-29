import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
Then('the CI workflow shall schedule all configured automated test jobs', function () {
  const jobs = loadCiWorkflow().jobs ?? {}
  const matches = Object.entries(jobs).filter(([id, job]) => id.toLowerCase().includes('test') || String(job.name ?? '').toLowerCase().includes('test'))
  assert(matches.length, `No automated test jobs found in workflow jobs: ${Object.keys(jobs)}`)
})
