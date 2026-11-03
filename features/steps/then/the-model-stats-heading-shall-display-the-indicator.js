import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually, screen } from '../sidebar_scenario_helper.js'
import { modelStatsHeadingIndicator } from '../model_sidebar_helper.js'

Then('the Model stats heading shall display the {string} indicator', { timeout: 15000 }, async function (indicator) {
  await eventually(this, text => modelStatsHeadingIndicator(text) === indicator,
    `Model stats heading must display ${indicator}`)
  assert.equal(modelStatsHeadingIndicator(screen(this)), indicator)
})
