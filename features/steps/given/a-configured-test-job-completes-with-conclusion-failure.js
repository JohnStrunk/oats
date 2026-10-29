import { Given } from '@cucumber/cucumber'
Given('a configured test job completes with conclusion "failure"', function () { (this.job_results ??= {}).test = 'failure' })
