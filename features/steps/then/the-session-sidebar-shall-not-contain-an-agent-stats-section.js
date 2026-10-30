import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually, screen } from '../sidebar_scenario_helper.js'

Then('the session sidebar shall not contain an Agent stats section', { timeout: 15000 }, async function () {
  await eventually(this, text => text.includes('Sidebar test'), 'the real session must be visible before checking the negative control')
  await new Promise(resolve => setTimeout(resolve, 2000))
  assert.doesNotMatch(screen(this), /Agent stats/, 'an unconfigured plugin must not render the section')
})
