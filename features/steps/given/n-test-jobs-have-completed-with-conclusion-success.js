import { Given } from '@cucumber/cucumber'
Given('{int} test jobs have completed with conclusion "success"', function (count) {
  this.synthetic_job_counts ??= {}
  this.synthetic_job_counts.test = count
  this.job_results ??= {}
  for (let i = 0; i < count; i++) this.job_results[`test_job_${i}`] = 'success'
})
