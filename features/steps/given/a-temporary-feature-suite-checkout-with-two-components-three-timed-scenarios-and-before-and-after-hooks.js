import { Given } from '@cucumber/cucumber'
import { createProfileCommandFixture } from '../profile-command-support.js'

Given('a temporary feature-suite checkout with two components, three timed scenarios, and before and after hooks', function () {
  this.profileFixture = createProfileCommandFixture()
})
