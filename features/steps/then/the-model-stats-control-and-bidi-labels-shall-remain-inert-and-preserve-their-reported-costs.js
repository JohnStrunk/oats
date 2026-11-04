import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { eventually } from '../sidebar_scenario_helper.js'
import { modelSidebarRows, modelStatsRowsHaveCosts } from '../model_sidebar_helper.js'
import { inspectModelNameSizing } from '../sidebar_model_alignment_helper.js'

Then('the Model stats control and bidi labels shall remain inert and preserve their reported costs', { timeout: 15000 }, async function () {
  const expected = [
    { identifier: 'clip\uFFFD]52;c;YQ==\uFFFD', cost: '$1.00', must_be_full: 'yes' },
    { identifier: 'bidi\uFFFDlabel', cost: '$2.00', must_be_full: 'yes' },
    { identifier: 'namedclip\uFFFD]52;c;YQ==\uFFFD', cost: '$3.00', must_be_full: 'yes' },
    { identifier: 'namedbidi\uFFFDlabel', cost: '$4.00', must_be_full: 'yes' },
    { identifier: `catalogue-${'overlong-'.repeat(8)}\uFFFD]52;c;YQ==\uFFFD\uFFFD-tail`, cost: '$5.00', must_be_full: 'no' },
    { identifier: '\uFFFD]0;OATS_NAME_SAFETY_TITLE\uFFFD\\', cost: '$6.00', must_be_full: 'yes' },
    { identifier: '\uFFFD[987;654H', cost: '$7.00', must_be_full: 'yes' },
  ]
  const costs = new Set(expected.map(({ cost }) => cost))
  const rendered = await eventually(this, text =>
    modelStatsRowsHaveCosts(text, costs) && inspectModelNameSizing(text, expected),
    'sanitized Model stats labels must remain distinct, bounded cost-row labels')

  const longNameRow = modelSidebarRows(rendered).find(row => row.value === '$5.00')
  assert.ok(longNameRow?.name.endsWith('…'), 'an overlong hostile catalogue name must be truncated to its available row width')
  assert.doesNotMatch(rendered.replaceAll('\n', ''), /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u,
    'the visible Model stats sidebar must not contain terminal or bidirectional controls')
  assert.ok(this.nameSafetyOutput?.length > 0, 'the PTY output must be captured for terminal-control checks')
  assert.doesNotMatch(this.nameSafetyOutput, /(?:\x1b\]|\u009d)52;c;YQ==\x07/u,
    'a Model stats label must not issue an OSC 52 clipboard command')
  assert.doesNotMatch(this.nameSafetyOutput, /\x1b\]0;OATS_NAME_SAFETY_TITLE/u,
    'a Model stats label must not issue an OSC title command')
  assert.doesNotMatch(this.nameSafetyOutput, /(?:\x1b\[|\u009b)987;654H/u,
    'a Model stats label must not issue a cursor-positioning command')
  assert.doesNotMatch(this.nameSafetyOutput, /[\u202a-\u202e\u2066-\u2069]/u,
    'bidirectional formatting controls must not reach the terminal')
})
