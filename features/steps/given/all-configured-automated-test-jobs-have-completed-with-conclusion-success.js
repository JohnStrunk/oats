import { Given } from '@cucumber/cucumber'
Given('all configured automated test jobs have completed with conclusion "success"', function () { (this.job_results ??= {}).test = 'success' })
