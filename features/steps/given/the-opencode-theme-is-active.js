import { Given } from '@cucumber/cucumber'

Given('the OpenCode theme {string} is active', function (themeName) {
  this.sidebarTheme = themeName
})
