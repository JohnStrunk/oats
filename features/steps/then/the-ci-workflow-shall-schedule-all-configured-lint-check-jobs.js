import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
Then('the CI workflow shall schedule all configured lint check jobs', function () {
  const jobs = loadCiWorkflow().jobs ?? {}
  const matches = Object.entries(jobs).filter(([id, job]) => id.toLowerCase().includes('lint') || String(job.name ?? '').toLowerCase().includes('lint'))
  assert(matches.length, `No lint check jobs found in workflow jobs: ${Object.keys(jobs)}`)
})
