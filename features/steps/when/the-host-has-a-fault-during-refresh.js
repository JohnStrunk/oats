import { When } from '@cucumber/cucumber'
import { boundedRefresh } from '../bounded_session_reads_helper.js'

When('the host has a {} during refresh', async function (fault) {
  this.readFault = fault
  this.bounded.setFault(fault)
  this.finished = await boundedRefresh(this.service)
  this.incomplete = structuredClone(this.service.getSnapshot())
  // Always release pending host operations, even if the watchdog fired.
  this.bounded.stop()
})
