import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelStatsRowsMatch } from '../model_sidebar_helper.js'
import { inspectModelNameSizing } from '../sidebar_model_alignment_helper.js'

Then('the Model stats control and bidi labels shall remain inert and preserve their reported costs', { timeout: 15000 }, async function () {
  const expected = [
    { identifier: 'clip\uFFFD]52;c;YQ==\uFFFD', cost: '$1.00', must_be_full: 'yes' },
    { identifier: 'bidi\uFFFDlabel', cost: '$2.00', must_be_full: 'yes' },
  ]
  const costs = new Map(expected.map(({ identifier, cost }) => [identifier, Number(cost.slice(1))]))
  const rendered = await eventually(this, text =>
    modelStatsRowsMatch(text, costs) && inspectModelNameSizing(text, expected),
  'sanitized Model stats identifiers must remain distinct, bounded cost-row labels')

  assert.doesNotMatch(rendered.replaceAll('\n', ''), /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u,
    'the visible Model stats sidebar must not contain terminal or bidirectional controls')
  assert.ok(this.nameSafetyOutput?.length > 0, 'the PTY output must be captured for terminal-control checks')
  assert.doesNotMatch(this.nameSafetyOutput, /(?:\x1b\]|\u009d)52;c;YQ==\x07/u,
    'a recorded model identifier must not issue an OSC 52 clipboard command')
  assert.doesNotMatch(this.nameSafetyOutput, /[\u202a-\u202e\u2066-\u2069]/u,
    'bidirectional formatting controls must not reach the terminal')
})
