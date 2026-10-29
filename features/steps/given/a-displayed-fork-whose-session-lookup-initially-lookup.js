import { Given } from '@cucumber/cucumber'
import { forkLookupFailureHost } from '../fork_lookup_failure_helper.js'

Given(/^a displayed fork whose session lookup initially (fails|is absent)$/, function (mode) {
  this.forkLookupHost = forkLookupFailureHost(mode)
})
