import { Given } from '@cucumber/cucumber'
Given('a configured lint check job completes with conclusion "skipped"', function () {
  (this.job_results ??= {})['lint-shell'] = 'skipped'
})
