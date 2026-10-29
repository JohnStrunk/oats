import { Given } from '@cucumber/cucumber'
import { boundedHost } from '../bounded_session_reads_helper.js'
import '../session_data_hooks.js'

Given('a session host with known records and controlled read limits', async function () {
  this.bounded = await boundedHost()
  this.service = this.bounded.service
})
