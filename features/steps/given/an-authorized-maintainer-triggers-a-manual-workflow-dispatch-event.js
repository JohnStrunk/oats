import { Given } from '@cucumber/cucumber'
Given('an authorized maintainer triggers a manual workflow dispatch event', function () { this.event_type = 'workflow_dispatch' })
