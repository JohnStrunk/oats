import assert from 'node:assert/strict'

// Validate actual child discovery before interpreting a failure as evidence.
export function requireFixtureScenario(scenarios, tag) {
  const expected = { failure: 'Failing scenario', undefined: 'Undefined scenario' }[tag]
  assert.ok(expected, `Unknown fixture tag: ${tag}`)
  assert.deepEqual(scenarios.map(s => s.name), [expected], 'Fixture selection did not isolate the requested scenario')
}
