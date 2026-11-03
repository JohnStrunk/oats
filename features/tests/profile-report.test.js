import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregateScenarioTimings,
  formatProfileReport,
  parseCucumberMessages,
  redactReportUrl,
  sanitizeReportText,
} from '../../scripts/profile-report.js'

const REDACTED_URL_PLACEHOLDER = '[redacted URL]'

function timestamp(milliseconds) {
  return { seconds: Math.floor(milliseconds / 1000), nanos: Math.round((milliseconds % 1000) * 1e6) }
}

function metaEnvelope() {
  return {
    meta: {
      protocolVersion: '34.2.1',
      implementation: { name: 'cucumber-js', version: '13.3.0' },
      cpu: { name: 'x64' },
      os: { name: 'linux', version: '6.1.0-test' },
      runtime: { name: 'node.js', version: '26.13.0' },
      ci: {
        name: 'GitHub Actions',
        url: 'https://github.test/example/oats/actions/runs/42',
        buildNumber: '42',
        git: {
          remote: 'https://github.test/example/oats.git',
          revision: '0123456789abcdef0123456789abcdef01234567',
          branch: 'profile-branch',
        },
      },
    },
  }
}

function scenarioEnvelopes({ testCaseId, pickleId, name, component, startedAt, elapsed, step, hook, stepHook = 0 }) {
  const beforeHookId = `${testCaseId}-before`
  const afterHookId = `${testCaseId}-after`
  const beforeStepHookId = `${testCaseId}-before-step`
  const testSteps = [
    { id: `${testCaseId}-step-hook`, hookId: beforeStepHookId },
    { id: `${testCaseId}-before`, hookId: beforeHookId },
    { id: `${testCaseId}-step`, pickleStepId: `${testCaseId}-pickle-step` },
    { id: `${testCaseId}-after`, hookId: afterHookId },
  ]
  const results = [
    { id: `${testCaseId}-step-hook`, milliseconds: stepHook },
    { id: `${testCaseId}-before`, milliseconds: hook / 2 },
    { id: `${testCaseId}-step`, milliseconds: step },
    { id: `${testCaseId}-after`, milliseconds: hook / 2 },
  ]
  const tags = component ? [{ name: `@component:${component}` }] : []
  return [
    { pickle: { id: pickleId, name, tags } },
    { hook: { id: beforeStepHookId, type: 'BEFORE_STEP' } },
    { hook: { id: beforeHookId, type: 'BEFORE_TEST_CASE' } },
    { hook: { id: afterHookId, type: 'AFTER_TEST_CASE' } },
    { testCase: { id: testCaseId, pickleId, testSteps } },
    { testCaseStarted: { id: `${testCaseId}-started`, testCaseId, timestamp: timestamp(startedAt) } },
    ...results.map(({ id, milliseconds }) => ({
      testStepFinished: {
        testCaseStartedId: `${testCaseId}-started`,
        testStepId: id,
        testStepResult: { duration: timestamp(milliseconds), status: 'PASSED' },
      },
    })),
    { testCaseFinished: { testCaseStartedId: `${testCaseId}-started`, timestamp: timestamp(startedAt + elapsed) } },
  ]
}

function fixtureEnvelopes() {
  return [
    metaEnvelope(),
    ...scenarioEnvelopes({
      testCaseId: 'tc-alpha',
      pickleId: 'pickle-alpha',
      name: 'alpha scenario',
      component: 'alpha',
      startedAt: 100000,
      elapsed: 500,
      step: 250,
      hook: 160,
      stepHook: 30,
    }),
    ...scenarioEnvelopes({
      testCaseId: 'tc-beta',
      pickleId: 'pickle-beta',
      name: 'beta scenario',
      component: 'beta',
      startedAt: 100600,
      elapsed: 300,
      step: 200,
      hook: 50,
    }),
  ]
}

test('aggregates scenario elapsed, Gherkin step, and scenario-hook timings', () => {
  const { meta, scenarios } = aggregateScenarioTimings(fixtureEnvelopes())
  assert.equal(meta.implementation.version, '13.3.0')
  assert.deepEqual(scenarios, [
    {
      name: 'alpha scenario',
      component: 'alpha',
      elapsedMilliseconds: 500,
      stepMilliseconds: 250,
      scenarioHookMilliseconds: 160,
    },
    {
      name: 'beta scenario',
      component: 'beta',
      elapsedMilliseconds: 300,
      stepMilliseconds: 200,
      scenarioHookMilliseconds: 50,
    },
  ])
})

test('does not report BeforeStep/AfterStep hook durations separately', () => {
  const { scenarios } = aggregateScenarioTimings(fixtureEnvelopes())
  const alpha = scenarios.find(scenario => scenario.name === 'alpha scenario')
  assert.equal(alpha.stepMilliseconds, 250, 'step-hook time must stay folded into the Gherkin step')
  assert.equal(alpha.scenarioHookMilliseconds, 160, 'only scenario-level hooks are reported separately')
})

test('keeps elapsed and duration metrics nonnegative and skips dangling references', () => {
  const envelopes = [
    ...scenarioEnvelopes({
      testCaseId: 'tc-reversed',
      pickleId: 'pickle-reversed',
      name: 'reversed scenario',
      component: 'alpha',
      startedAt: 2000,
      elapsed: -500,
      step: -200,
      hook: 0,
    }),
    { testCaseFinished: { testCaseStartedId: 'missing-attempt', timestamp: timestamp(1) } },
  ]
  const { scenarios } = aggregateScenarioTimings(envelopes)
  assert.equal(scenarios.length, 1)
  assert.equal(scenarios[0].elapsedMilliseconds, 0)
  assert.equal(scenarios[0].stepMilliseconds, 0)
  assert.equal(scenarios[0].scenarioHookMilliseconds, 0)
})

test('assigns a component placeholder when the pickle has no @component tag', () => {
  const { scenarios } = aggregateScenarioTimings(scenarioEnvelopes({
    testCaseId: 'tc-unassigned',
    pickleId: 'pickle-unassigned',
    name: 'untagged scenario',
    component: null,
    startedAt: 0,
    elapsed: 10,
    step: 5,
    hook: 0,
  }))
  assert.equal(scenarios[0].component, 'unassigned')
})

test('fails closed on malformed reports only when strict parsing is requested', () => {
  assert.deepEqual(parseCucumberMessages('{"meta":{}}\nnot json\n'), [{ meta: {} }])
  assert.deepEqual(parseCucumberMessages('{"meta":{}}\nnull\n'), [{ meta: {} }])
  assert.throws(() => parseCucumberMessages('{"meta":{}}\nnot json\n', { strict: true }), /line 2/)
  assert.throws(() => parseCucumberMessages('null\n', { strict: true }), /envelope/)
  assert.throws(() => parseCucumberMessages('', { strict: true }), /empty/)
})

test('escapes ANSI and control characters in untrusted names', () => {
  assert.equal(sanitizeReportText('evil\u001b[31mred\u001b[0m\nnext'), 'evilred\\u000anext')
  assert.equal(sanitizeReportText('bell\u0007'), 'bell\\u0007')
})

test('formats suite, residual, per-scenario, component, and runtime context lines', () => {
  const { meta, scenarios } = aggregateScenarioTimings(fixtureEnvelopes())
  const report = formatProfileReport({ meta, scenarios, wallMilliseconds: 1200, exit: { code: 0, signal: null } })
  const lines = report.split('\n')

  assert.ok(lines.includes('Complete feature-suite elapsed: 1200.0 ms'), report)
  assert.ok(lines.includes('Scenario elapsed total: 800.0 ms'), report)
  assert.ok(lines.includes('Residual setup/framework overhead: 400.0 ms'), report)

  const alphaElapsed = lines.find(line => line.includes('alpha scenario') && /scenario.*elapsed/i.test(line))
  assert.ok(alphaElapsed?.includes('500.0 ms'), report)
  const alphaStep = lines.find(line => line.includes('alpha scenario') && /gherkin\s+step\s+time/i.test(line))
  assert.ok(alphaStep?.includes('250.0 ms'), report)
  const alphaHook = lines.find(line => line.includes('alpha scenario') && /scenario\s+hook\s+time/i.test(line))
  assert.ok(alphaHook?.includes('160.0 ms'), report)

  assert.ok(lines.includes('Component total [alpha] 500.0 ms (1 scenario)'), report)
  assert.ok(lines.includes('Component total [beta] 300.0 ms (1 scenario)'), report)
  assert.ok(lines.some(line => /before.?step.*after.?step/i.test(line) && /included|folded/i.test(line)), report)
  assert.ok(lines.some(line => /cucumber/i.test(line) && line.includes('13.3.0')), report)
  assert.ok(lines.some(line => /node(?:\.js)?/i.test(line) && line.includes('26.13.0')), report)
  assert.ok(lines.some(line => /cpu|architecture/i.test(line) && line.includes('x64')), report)
  assert.ok(lines.includes('  CI provider: GitHub Actions'), report)
  assert.ok(lines.includes('  CI build URL: https://github.test/example/oats/actions/runs/42'), report)
  assert.ok(lines.includes('  CI Git remote: https://github.test/example/oats.git'), report)
  assert.ok(lines.includes('  CI Git branch: profile-branch'), report)
})

test('report residual always equals displayed suite time minus displayed scenario times', () => {
  const { meta, scenarios } = aggregateScenarioTimings(fixtureEnvelopes())
  const report = formatProfileReport({ meta, scenarios, wallMilliseconds: 1000.04 })
  const lines = report.split('\n')
  const suite = Number(lines.find(line => /complete.*elapsed/i.test(line)).match(/([\d.]+) ms/)[1])
  const residual = Number(lines.find(line => /residual.*overhead/i.test(line)).match(/([\d.]+) ms/)[1])
  const scenarioTotal = scenarios.reduce((total, scenario) => total + scenario.elapsedMilliseconds, 0)
  assert.equal(residual, Math.round((suite - scenarioTotal) * 10) / 10)
})

test('redacts link credentials, query strings, and fragments from runtime context', () => {
  const envelopes = fixtureEnvelopes()
  envelopes[0].meta.ci.url = 'https://ci-user:fixture-url-password@github.test/example/oats/actions/runs/42'
    + '?token=fixture-url-token#fixture-url-fragment'
  envelopes[0].meta.ci.git.remote = 'https://x-access-token:fixture-git-token@github.test/example/oats.git'
    + '?expires=fixture-git-expiry#fixture-git-fragment'
  const { meta, scenarios } = aggregateScenarioTimings(envelopes)
  const report = formatProfileReport({ meta, scenarios, wallMilliseconds: 1200 })

  assert.ok(report.includes('  CI build URL: https://github.test/example/oats/actions/runs/42'), report)
  assert.ok(report.includes('  CI Git remote: https://github.test/example/oats.git'), report)
  for (const secret of [
    'ci-user',
    'fixture-url-password',
    'fixture-url-token',
    'fixture-url-fragment',
    'x-access-token',
    'fixture-git-token',
    'fixture-git-expiry',
    'fixture-git-fragment',
  ]) {
    assert.ok(!report.includes(secret), `report leaked ${secret}:\n${report}`)
  }
})

test('redacts parseable URLs to their scheme, host, and path', () => {
  assert.equal(redactReportUrl('https://github.test/example/oats/actions/runs/42?token=abc#top'),
    'https://github.test/example/oats/actions/runs/42')
  assert.equal(redactReportUrl('https://github.test/example/oats.git'), 'https://github.test/example/oats.git')
  assert.equal(redactReportUrl('https://user:fixture-password@ci.example/oats.git?token=fixture-token#top'),
    'https://ci.example/oats.git')
  assert.equal(redactReportUrl('ssh://git@github.test/example/oats.git'), 'ssh://github.test/example/oats.git')
  // A space in the path is still parseable; the parser percent-encodes it.
  assert.equal(redactReportUrl('https://github.test/exa mple/oats.git?token=fixture-token'),
    'https://github.test/exa%20mple/oats.git')
})

test('fails closed on malformed URLs so hidden credentials cannot leak', () => {
  for (const value of [
    // `?`/`#` before the userinfo delimiter hides it from structural parsing.
    'https://user:fixture-secret?@ci.example',
    'https://user:fixture-secret#@ci.example',
    'https://user:fixture-secret@github.test:99999/oats.git?token=fixture-token',
    'https://github .test/oats.git?token=fixture-token',
    // Without a scheme there is nothing reliable to redact either.
    'user:fixture-secret@github.test/example/oats.git#main',
  ]) {
    const redacted = redactReportUrl(value)
    assert.equal(redacted, REDACTED_URL_PLACEHOLDER, value)
    assert.ok(!redacted.includes('fixture-secret'), `redaction leaked a credential for ${value}: ${redacted}`)
  }
})

test('fails closed on protocol-relative URLs that hide credentials', () => {
  // No scheme means no structural parse; `//` must not be echoed with its userinfo.
  const redacted = redactReportUrl('//user:fixture-secret@ci.example/oats.git?token=fixture-token')
  assert.equal(redacted, REDACTED_URL_PLACEHOLDER)
  assert.ok(!redacted.includes('fixture-secret'), `redaction leaked a credential: ${redacted}`)
  assert.ok(!redacted.includes('fixture-token'), `redaction leaked a query token: ${redacted}`)
})

test('preserves only the known safe SCP-style git remote form', () => {
  assert.equal(redactReportUrl('git@github.test:example/oats.git'), 'git@github.test:example/oats.git')
  // Any other user or trailing query/fragment cannot be vouched for.
  assert.equal(redactReportUrl('deploy@github.test:example/oats.git'), REDACTED_URL_PLACEHOLDER)
  assert.equal(redactReportUrl('git@github.test:example/oats.git?token=fixture-token'), REDACTED_URL_PLACEHOLDER)
})
