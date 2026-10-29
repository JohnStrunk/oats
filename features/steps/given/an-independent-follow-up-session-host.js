import { Given } from '@cucumber/cucumber'
import { followupHost } from '../followup_major_host.js'

Given('an independent follow-up session host', function () {
  this.followupHost = followupHost()
})
