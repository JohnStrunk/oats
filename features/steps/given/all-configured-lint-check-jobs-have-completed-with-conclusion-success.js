import { Given } from '@cucumber/cucumber'
Given('all configured lint check jobs have completed with conclusion "success"', function () {
  Object.assign(this.job_results ??= {}, { 'lint-markdown': 'success', 'lint-yaml-and-workflows': 'success', 'lint-shell': 'success' })
})
