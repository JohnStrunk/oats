import { Given } from '@cucumber/cucumber'
import { hostFixture, makeService } from '../session_data_helper.js'
import '../session_data_hooks.js'

Given('the session data host fixture {string}', async function (name) {
  const fixture = hostFixture(name)
  this.host = fixture.state
  this.context = fixture.context
  this.service = await makeService(this.context)
})
