import { Given } from '@cucumber/cucumber'
Given('a commit is pushed directly to branch "main"', function () { this.event_type = 'push'; this.target_branch = 'main' })
