import { Then } from '@cucumber/cucumber'
import { checkOpentuiVersionCap } from '../opencode_stack_helper.js'

// Deliberately verifies only the configured cap: whether upstream releases
// exist or the plugin line accepts other peers cannot be established here.
Then('the OpenTUI version cap shall restrict only the OpenTUI packages to the 0.7.x line', function () {
  checkOpentuiVersionCap(this.renovate_config)
})
