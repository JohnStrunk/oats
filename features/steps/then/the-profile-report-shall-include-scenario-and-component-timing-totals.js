import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import fc from 'fast-check'
import {
  profileDurationMilliseconds,
  profileReportLines,
  profileFixtureExecutions,
} from '../profile-command-support.js'

const TIMING_ROUNDING_TOLERANCE_MS = 0.1
const PROFILE_PROPERTY_SEED = 50050
const PROFILE_PROPERTY_RUNS = 100
const NANOSECONDS_PER_TENTH_MILLISECOND = 100_000

const profileTimingScenarioArbitrary = fc.record({
  component: fc.constantFrom('repo-infrastructure', 'plugin-ui'),
  startedAtTenths: fc.integer({ min: 0, max: 1_000_000_000 }),
  stepTenths: fc.integer({ min: 0, max: 1_000_000_000 }),
  hookTenths: fc.integer({ min: 0, max: 1_000_000_000 }),
  slackTenths: fc.integer({ min: 0, max: 1_000_000_000 }),
})
const generatedProfileCaseArbitrary = fc.record({
  scenarios: fc.array(profileTimingScenarioArbitrary, { maxLength: 5 }),
  residualTenths: fc.integer({ min: 0, max: 1_000_000_000 }),
})

function exactReportLine(lines, predicate, label) {
  const matches = lines.filter(predicate)
  assert.equal(matches.length, 1, `Expected exactly one ${label} report line, found ${matches.length}`)
  return matches[0]
}

function exactReportDuration(lines, predicate, label) {
  const line = exactReportLine(lines, predicate, label)
  const milliseconds = profileDurationMilliseconds(line)
  assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0,
    `${label} did not have a nonnegative duration: ${line}`)
  return milliseconds
}

function reportedTenths(lines, predicate, label) {
  return Math.round(exactReportDuration(lines, predicate, label) * 10)
}

function timestampFromTenths(tenths) {
  const nanoseconds = tenths * NANOSECONDS_PER_TENTH_MILLISECOND
  const seconds = Math.floor(nanoseconds / 1_000_000_000)
  return { seconds, nanos: nanoseconds - seconds * 1_000_000_000 }
}

function cucumberTimingEnvelopes(scenario, index) {
  const testCaseId = `property-test-case-${index}`
  const pickleId = `property-pickle-${index}`
  const attemptId = `property-attempt-${index}`
  const beforeHookId = `property-before-hook-${index}`
  const afterHookId = `property-after-hook-${index}`
  const beforeStepId = `property-before-step-${index}`
  const beforeHookTenths = Math.floor(scenario.hookTenths / 2)
  const afterHookTenths = scenario.hookTenths - beforeHookTenths
  const elapsedTenths = scenario.stepTenths + scenario.hookTenths + scenario.slackTenths
  const beforeStep = { id: beforeStepId, hookId: beforeHookId }
  const gherkinStep = { id: `property-gherkin-step-${index}`, pickleStepId: `property-pickle-step-${index}` }
  const afterStep = { id: `property-after-hook-step-${index}`, hookId: afterHookId }
  const finishedStep = (testStepId, durationTenths) => ({
    testStepFinished: {
      testCaseStartedId: attemptId,
      testStepId,
      testStepResult: {
        duration: timestampFromTenths(durationTenths),
        status: 'PASSED',
      },
    },
  })

  return [
    { pickle: { id: pickleId, name: scenario.name, tags: [{ name: `@component:${scenario.component}` }] } },
    { hook: { id: beforeHookId, type: 'BEFORE_TEST_CASE' } },
    { hook: { id: afterHookId, type: 'AFTER_TEST_CASE' } },
    { testCase: { id: testCaseId, pickleId, testSteps: [beforeStep, gherkinStep, afterStep] } },
    { testCaseStarted: { id: attemptId, testCaseId, timestamp: timestampFromTenths(scenario.startedAtTenths) } },
    finishedStep(beforeStep.id, beforeHookTenths),
    finishedStep(gherkinStep.id, scenario.stepTenths),
    finishedStep(afterStep.id, afterHookTenths),
    { testCaseFinished: { testCaseStartedId: attemptId, timestamp: timestampFromTenths(scenario.startedAtTenths + elapsedTenths) } },
  ]
}

function assertGeneratedProfileReportInvariants(
  { scenarios: generatedScenarios, residualTenths },
  { aggregateScenarioTimings, formatProfileReport },
) {
  // Always include zero and large timings so each deterministic run exercises boundary scales.
  const scenarios = [
    {
      name: 'generated zero timing scenario',
      component: 'repo-infrastructure',
      startedAtTenths: 0,
      stepTenths: 0,
      hookTenths: 0,
      slackTenths: 0,
    },
    {
      name: 'generated large timing scenario',
      component: 'plugin-ui',
      startedAtTenths: 1_000_000_000,
      stepTenths: 1_000_000_000,
      hookTenths: 1_000_000_000,
      slackTenths: 1_000_000_000,
    },
    ...generatedScenarios.map((scenario, index) => ({
      ...scenario,
      name: `generated variable timing scenario ${index}`,
    })),
  ].map(scenario => ({
    ...scenario,
    elapsedTenths: scenario.stepTenths + scenario.hookTenths + scenario.slackTenths,
  }))
  const envelopes = scenarios.flatMap(cucumberTimingEnvelopes)
  const { meta, scenarios: aggregatedScenarios } = aggregateScenarioTimings(envelopes)
  assert.equal(aggregatedScenarios.length, scenarios.length, 'Cucumber envelope aggregation omitted a generated scenario')

  for (const [index, scenario] of scenarios.entries()) {
    const aggregated = aggregatedScenarios[index]
    assert.equal(aggregated.name, scenario.name)
    assert.equal(aggregated.component, scenario.component)
    for (const [field, tenths] of [
      ['elapsedMilliseconds', scenario.elapsedTenths],
      ['stepMilliseconds', scenario.stepTenths],
      ['scenarioHookMilliseconds', scenario.hookTenths],
    ]) {
      assert.ok(Number.isFinite(aggregated[field]) && aggregated[field] >= 0,
        `Generated ${field} for ${scenario.name} was not nonnegative`)
      assert.equal(Math.round(aggregated[field] * 10), tenths,
        `Generated ${field} for ${scenario.name} did not match its Cucumber timing envelope`)
    }
  }

  const scenarioTotalTenths = scenarios.reduce((total, scenario) => total + scenario.elapsedTenths, 0)
  const suiteElapsedTenths = scenarioTotalTenths + residualTenths
  const report = formatProfileReport({
    meta,
    scenarios: aggregatedScenarios,
    wallMilliseconds: suiteElapsedTenths / 10,
  })
  const lines = report.split(/\r?\n/)
  const scenarioReportTenths = new Map()

  for (const scenario of scenarios) {
    const byScenarioName = line => line.endsWith(`[component: ${scenario.component}] ${scenario.name}`)
    const elapsedTenths = reportedTenths(lines,
      line => line.startsWith('Scenario elapsed ') && byScenarioName(line),
      `scenario elapsed for ${scenario.name}`)
    const stepTenths = reportedTenths(lines,
      line => line.startsWith('  Gherkin step time ') && line.endsWith(` - ${scenario.name}`),
      `Gherkin step time for ${scenario.name}`)
    const hookTenths = reportedTenths(lines,
      line => line.startsWith('  Scenario hook time ') && line.endsWith(` - ${scenario.name}`),
      `scenario hook time for ${scenario.name}`)

    assert.equal(elapsedTenths, scenario.elapsedTenths, `Reported elapsed time for ${scenario.name} changed`)
    assert.equal(stepTenths, scenario.stepTenths, `Reported step time for ${scenario.name} changed`)
    assert.equal(hookTenths, scenario.hookTenths, `Reported hook time for ${scenario.name} changed`)
    scenarioReportTenths.set(scenario.name, elapsedTenths)
  }

  for (const component of new Set(scenarios.map(scenario => scenario.component))) {
    const componentTotalTenths = reportedTenths(lines,
      line => line.startsWith(`Component total [${component}] `),
      `component total for ${component}`)
    const scenarioSumTenths = scenarios
      .filter(scenario => scenario.component === component)
      .reduce((total, scenario) => total + scenarioReportTenths.get(scenario.name), 0)
    assert.equal(componentTotalTenths, scenarioSumTenths,
      `Reported total for ${component} did not equal its reported scenario sum`)
  }

  const reportedScenarioTotalTenths = reportedTenths(lines,
    line => line.startsWith('Scenario elapsed total: '), 'scenario elapsed total')
  const reportedResidualTenths = reportedTenths(lines,
    line => line.startsWith('Residual setup/framework overhead: '), 'residual setup/framework overhead')
  const reportedSuiteTenths = reportedTenths(lines,
    line => line.startsWith('Complete feature-suite elapsed: '), 'complete feature-suite elapsed time')
  assert.equal(reportedScenarioTotalTenths, scenarioTotalTenths,
    'Reported scenario total did not match the generated scenario elapsed sum')
  assert.equal(reportedResidualTenths, residualTenths,
    'Reported setup residual did not match the generated residual')
  assert.equal(reportedSuiteTenths, suiteElapsedTenths,
    'Reported suite elapsed time did not match the generated suite timing')
  assert.equal(reportedScenarioTotalTenths + reportedResidualTenths, reportedSuiteTenths,
    'Reported scenario total plus residual did not equal suite time')
}

Then('the profile report shall include scenario and component timing totals', async function () {
  const output = profileReportLines(this.profileResult)
  const executed = profileFixtureExecutions(this.profileFixture)
  const scenarioTimes = new Map()

  for (const scenario of this.profileFixture.scenarios) {
    assert.ok(executed.includes(scenario.name), `The profiler did not execute fixture scenario ${scenario.name}`)
    const control = this.routineScenarioMetrics.find(metric => metric.name === scenario.name)
    assert.ok(control, `The independent Cucumber message run omitted fixture scenario ${scenario.name}`)
    const line = exactReportLine(output,
      candidate => candidate.startsWith('Scenario elapsed ') &&
        candidate.endsWith(`[component: ${scenario.component}] ${scenario.name}`),
      `scenario elapsed for ${scenario.name}`)
    const reportedMilliseconds = profileDurationMilliseconds(line)
    assert.ok(Number.isFinite(reportedMilliseconds) && reportedMilliseconds > 0,
      `The report did not include a positive elapsed time for ${scenario.name}: ${line}`)
    scenarioTimes.set(scenario.name, reportedMilliseconds)
  }

  for (const component of new Set(this.profileFixture.scenarios.map(scenario => scenario.component))) {
    const line = exactReportLine(output,
      candidate => candidate.startsWith(`Component total [${component}] `),
      `component total for ${component}`)

    const expectedTotal = this.profileFixture.scenarios
      .filter(scenario => scenario.component === component)
      .reduce((total, scenario) => total + scenarioTimes.get(scenario.name), 0)
    const reportedTotal = profileDurationMilliseconds(line)
    assert.ok(Math.abs(reportedTotal - expectedTotal) <= TIMING_ROUNDING_TOLERANCE_MS,
      `The ${component} total ${reportedTotal}ms did not equal its scenario-time sum ${expectedTotal}ms`)
  }

  this.profileScenarioMilliseconds = scenarioTimes
  // The deterministic property complements, rather than replaces, the CLI-boundary assertions above.
  const profileReport = await import('../../../scripts/profile-report.js')
  fc.assert(fc.property(generatedProfileCaseArbitrary,
    generatedCase => assertGeneratedProfileReportInvariants(generatedCase, profileReport)), {
    seed: PROFILE_PROPERTY_SEED,
    numRuns: PROFILE_PROPERTY_RUNS,
    endOnFailure: true,
  })
})
