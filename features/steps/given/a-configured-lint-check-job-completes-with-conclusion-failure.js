import { Given } from '@cucumber/cucumber'
Given('a configured lint check job completes with conclusion "failure"', function () { (this.job_results ??= {})['lint-markdown'] = 'failure' })
