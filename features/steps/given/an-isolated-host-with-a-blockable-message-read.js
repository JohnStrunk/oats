import { Given } from '@cucumber/cucumber'
import { staleReadHost } from '../settlement_boundary_helper.js'

Given('an isolated host with a blockable message read', function () {
  this.regressionHosts = [staleReadHost()]
  this.regressionHost = this.regressionHosts[0]
})
