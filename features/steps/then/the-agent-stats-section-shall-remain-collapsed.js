import { Then } from '@cucumber/cucumber'
import { eventually } from '../usage_details_helper.js'

Then('the Agent stats section shall remain collapsed', { timeout: 15000 }, async function () {
  await eventually(this, text => /[▸▶]\s+Agent stats/.test(text) && !/alpha:/.test(text) && !/\bPrice\b/.test(text), 'dismissal must reveal the still-collapsed sidebar')
})
