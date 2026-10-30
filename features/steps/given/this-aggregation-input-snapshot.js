import { Given } from '@cucumber/cucumber'

Given('this aggregation input snapshot:', function (snapshot) {
  this.aggregationInput = JSON.parse(snapshot)
})
