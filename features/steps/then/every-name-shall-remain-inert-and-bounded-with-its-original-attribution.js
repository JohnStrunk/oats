import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import { checkNameSafety } from '../sidebar_name_safety_helper.js'

Then('every name shall remain inert and bounded with its original attribution', { timeout: 180000 }, async function () {
  // The fixed corpus makes each control family mandatory, independent of the seed.
  const terminalControls = [
    '\x00', '\x01', '\x07', '\b', '\t', '\nFORGED: $999.00\n', '\r', '\x1b[2J', '\x1b[987;654H',
    '\x1b]52;c;T0FUU19TRUNVUklUWV9PU0M=\x07', '\x7f', '\x85', '\x9b2J', '\x9d52;c;T0FUU19TRUNVUklUWV9PU0M=\x9c',
    '\x1b]0;OATS_NAME_SAFETY_TITLE\x1b\\',
  ]
  const bidi = [
    '\u202a', '\u202b', '\u202c', '\u202d', '\u202e', '\u2066', '\u2067', '\u2068', '\u2069',
  ]
  let index = 0
  if (this.nameSafetyFamily === 'generated') {
    const control = fc.oneof(
      fc.constantFrom(...terminalControls, ...bidi),
      fc.integer({ min: 0, max: 31 }).map(n => String.fromCodePoint(n)),
      fc.integer({ min: 127, max: 159 }).map(n => String.fromCodePoint(n)),
    )
    await fc.assert(fc.asyncProperty(
      fc.array(control, { minLength: 1, maxLength: 5 }),
      async parts => checkNameSafety(this, parts.join(''), index++),
    ), { seed: 610601, numRuns: 20, endOnFailure: true })
  } else {
    const cases = { controls: terminalControls, bidi, long: ['x'.repeat(10000), '界'.repeat(10000)] }
    if (!cases[this.nameSafetyFamily]) throw new Error(`unknown safety family ${this.nameSafetyFamily}`)
    for (const control of cases[this.nameSafetyFamily]) await checkNameSafety(this, control, index++)
  }
})
