import { Given } from '@cucumber/cucumber'
Given('a configured test or lint job completes with conclusion "cancelled"', function () { (this.job_results ??= {}).test = 'cancelled' })
