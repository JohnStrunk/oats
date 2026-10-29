import { Given } from '@cucumber/cucumber'
import { regressionHost } from '../regression_session_helper.js'
Given('an isolated regression session host', function () {
  this.regressionHosts = [regressionHost()]
  this.regressionHost = this.regressionHosts[0]
})
