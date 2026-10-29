import { Given } from '@cucumber/cucumber'
import { lookupRegressionHost } from '../lookup_regression_helper.js'

Given('an isolated non-fork session with a controllable lookup', async function () {
  this.lookupRegressionHost = await lookupRegressionHost()
})
