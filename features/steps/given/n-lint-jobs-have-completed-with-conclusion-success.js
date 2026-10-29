import { Given } from '@cucumber/cucumber'
Given('{int} lint jobs have completed with conclusion "success"', function (count) {
  this.synthetic_job_counts ??= {}
  this.synthetic_job_counts.lint = count
  this.job_results ??= {}
  for (let i = 0; i < count; i++) this.job_results[`lint_job_${i}`] = 'success'
})
