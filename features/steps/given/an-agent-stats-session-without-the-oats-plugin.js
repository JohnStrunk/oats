import { Given } from '@cucumber/cucumber'

Given('an Agent stats session without the OATS plugin', function () {
  this.sidebarFixtureName = 'history'
  this.sidebarDisabled = true
})
