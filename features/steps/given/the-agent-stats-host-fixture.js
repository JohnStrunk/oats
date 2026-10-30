import { Given } from '@cucumber/cucumber'
import { sidebarHost } from '../sidebar_host_helper.js'

Given('the Agent stats host fixture {string}', function (name) {
  this.sidebarFixtureName = name
  this.sidebarHost = sidebarHost()
})
