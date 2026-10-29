import { Given } from '@cucumber/cucumber'
Given('a pull request targeting "main" is opened or updated', function () { this.event_type = 'pull_request'; this.target_branch = 'main'; this.event_action = 'opened' })
