import { When } from '@cucumber/cucumber'

When('the user dismisses the usage details modal', function () {
  this.sidebarPty.send('\x1b')
})
