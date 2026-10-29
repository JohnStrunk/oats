import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { loadCiWorkflow } from '../workflow_helper.js'
import { assertGeneratedGateSuccessOnce } from '../workflow_gate_property.js'
Then('the "Successful CI" job conclusion shall be {string}', { timeout: 120000 }, function (expected) {
  assert.equal(this.actual_conclusion, expected, `Expected gate conclusion '${expected}', but got '${this.actual_conclusion}'`)
  if (expected === 'success' && this.synthetic_job_counts) assertGeneratedGateSuccessOnce(loadCiWorkflow())
})
