import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import {
  PROFILE_FIXTURE_CI_CONTEXT,
  profileDurationMilliseconds,
  profileReportLines,
} from '../profile-command-support.js'

const TIMING_ROUNDING_TOLERANCE_MS = 0.1 // The report rounds each duration to one decimal millisecond.
// Scenario boundaries use millisecond-resolution Date.now() timestamps; step and hook durations use a high-resolution clock.
const SCENARIO_TIMESTAMP_RESOLUTION_ALLOWANCE_MS = 2

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

Then('the profile report shall include per-scenario step and scenario-hook costs, suite residual timing, and runtime context', function () {
  const profileScenarioMilliseconds = this.profileScenarioMilliseconds
  assert.ok(profileScenarioMilliseconds instanceof Map,
    'Scenario elapsed timings were not established before checking dependent report invariants')
  assert.equal(profileScenarioMilliseconds.size, this.profileFixture.scenarios.length,
    'The profile report did not produce a scenario elapsed timing for every fixture scenario')
  const output = profileReportLines(this.profileResult)
  for (const scenario of this.profileFixture.scenarios) {
    const control = this.routineScenarioMetrics.find(metric => metric.name === scenario.name)
    assert.ok(control, `The independent Cucumber message run omitted fixture scenario ${scenario.name}`)

    const stepMilliseconds = exactReportDuration(output,
      line => line.startsWith('  Gherkin step time ') && line.endsWith(` - ${scenario.name}`),
      `Gherkin step time for ${scenario.name}`)
    assert.ok(stepMilliseconds >= 210,
      `The ${scenario.name} step total ${stepMilliseconds}ms did not reflect its 120ms step plus before/after-step hooks`)

    const hookMilliseconds = exactReportDuration(output,
      line => line.startsWith('  Scenario hook time ') && line.endsWith(` - ${scenario.name}`),
      `scenario hook time for ${scenario.name}`)
    assert.ok(hookMilliseconds >= 70,
      `The ${scenario.name} scenario-hook total ${hookMilliseconds}ms did not reflect its before/after hooks`)

    assert.ok(profileScenarioMilliseconds.has(scenario.name), `The profile report omitted elapsed time for ${scenario.name}`)
    const scenarioMilliseconds = profileScenarioMilliseconds.get(scenario.name)
    assert.ok(Number.isFinite(scenarioMilliseconds) && scenarioMilliseconds >= 0,
      `The profile report had no nonnegative elapsed time for ${scenario.name}`)
    assert.ok(scenarioMilliseconds + TIMING_ROUNDING_TOLERANCE_MS + SCENARIO_TIMESTAMP_RESOLUTION_ALLOWANCE_MS >= stepMilliseconds + hookMilliseconds,
      `Reported scenario time for ${scenario.name} was less than its step and scenario-hook costs`)
  }

  const stepHookNote = exactReportLine(output,
    line => line.startsWith('Note: In Cucumber.js '), 'Cucumber step-hook timing note')
  assert.ok(/before.?step.*after.?step/i.test(stepHookNote) && /included|folded/i.test(stepHookNote),
    `The report did not disclose that per-step hooks are included in Gherkin-step time:\n${output.join('\n')}`)

  assert.ok(output.includes('Runtime context'), 'The report did not include its runtime-context section')
  const suiteMilliseconds = exactReportDuration(output,
    line => line.startsWith('Complete feature-suite elapsed: '), 'complete feature-suite elapsed time')
  const scenarioTotal = [...profileScenarioMilliseconds.values()].reduce((total, value) => total + value, 0)
  const reportedScenarioTotal = exactReportDuration(output,
    line => line.startsWith('Scenario elapsed total: '), 'scenario elapsed total')
  assert.ok(Math.abs(reportedScenarioTotal - scenarioTotal) <= TIMING_ROUNDING_TOLERANCE_MS,
    `Reported scenario total ${reportedScenarioTotal}ms did not equal its per-scenario sum ${scenarioTotal}ms`)

  const residualMilliseconds = exactReportDuration(output,
    line => line.startsWith('Residual setup/framework overhead: '), 'residual setup/framework overhead')
  const expectedResidualMilliseconds = Math.max(0, suiteMilliseconds - reportedScenarioTotal)
  assert.ok(Math.abs(residualMilliseconds - expectedResidualMilliseconds) <= TIMING_ROUNDING_TOLERANCE_MS,
    `Residual overhead ${residualMilliseconds}ms did not match max(0, suite time - reported scenario total) ${expectedResidualMilliseconds}ms`)
  const sameReportTotal = reportedScenarioTotal + residualMilliseconds
  const expectedSameReportTotal = Math.max(reportedScenarioTotal, suiteMilliseconds)
  assert.ok(Math.abs(sameReportTotal - expectedSameReportTotal) <= TIMING_ROUNDING_TOLERANCE_MS,
    `Reported scenario total plus residual ${sameReportTotal}ms did not match the clamped suite/scenario total ${expectedSameReportTotal}ms`)
  assert.ok(Number.isFinite(this.profileInvocationMilliseconds) && this.profileInvocationMilliseconds >= 0,
    'The profiler invocation did not produce a nonnegative wall-clock duration')
  assert.ok(this.profileInvocationMilliseconds + TIMING_ROUNDING_TOLERANCE_MS >= suiteMilliseconds,
    'The reported suite elapsed time exceeded the independently measured profiler invocation')

  const context = this.routineMessageContext
  assert.ok(context, 'The independent Cucumber message run did not report runtime context')
  const cucumberLine = exactReportLine(output, line => line.startsWith('  Cucumber.js: '), 'Cucumber.js version')
  assert.ok(cucumberLine.includes(context.cucumberVersion),
    `The report omitted Cucumber.js version ${context.cucumberVersion}`)
  const nodeLine = exactReportLine(output, line => line.startsWith('  Node.js: '), 'Node.js version')
  assert.ok(nodeLine.includes(context.nodeVersion), `The report omitted Node.js version ${context.nodeVersion}`)
  const osLine = exactReportLine(output, line => line.startsWith('  OS: '), 'operating-system context')
  assert.ok(osLine.toLowerCase().includes(context.osName.toLowerCase()) &&
    osLine.toLowerCase().includes(context.osRelease.toLowerCase()),
  'The report omitted Cucumber Meta OS name/release')
  const architectureLine = exactReportLine(output, line => line.startsWith('  CPU architecture: '), 'CPU architecture')
  assert.ok(architectureLine.toLowerCase().includes(context.cpuArchitecture.toLowerCase()),
    `The report omitted CPU architecture ${context.cpuArchitecture}`)

  assert.deepEqual(context.ci, PROFILE_FIXTURE_CI_CONTEXT,
    'The pinned Cucumber message control did not expose the fixture CI build and Git context')
  const ciContext = context.ci
  for (const [field, value] of [
    ['CI provider', ciContext.name],
    ['CI build URL', ciContext.url],
    ['CI build number', ciContext.buildNumber],
    ['CI Git remote', ciContext.git.remote],
    ['CI Git revision', ciContext.git.revision],
    ['CI Git branch', ciContext.git.branch],
  ]) {
    const line = exactReportLine(output,
      candidate => candidate.startsWith(`  ${field}:`), field)
    assert.ok(line.endsWith(value), `The report omitted ${field} ${value}`)
  }
})
