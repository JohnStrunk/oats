import { After } from '@cucumber/cucumber'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sandboxEnvironment } from '../tests/migration-sandbox.js'

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const PROBE_FILE = 'profile-fixture-executions.log'
const DURATION_TOKEN = /([+-]?\d+(?:\.\d+)?)\s*(nanoseconds?|ns|microseconds?|[µμ]s|us|milliseconds?|msec|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/giu
const CLOCK_DURATION = /(?<![\d.])([+-]?)(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d+))?(?![\d:])/u
const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/gu

export const PROFILE_FIXTURE_SCENARIOS = Object.freeze([
  Object.freeze({ name: 'Profiler fixture infrastructure scenario one', component: 'repo-infrastructure' }),
  Object.freeze({ name: 'Profiler fixture infrastructure scenario two', component: 'repo-infrastructure' }),
  Object.freeze({ name: 'Profiler fixture plugin UI scenario', component: 'plugin-ui' }),
])

export const PROFILE_FIXTURE_CI_CONTEXT = Object.freeze({
  name: 'GitHub Actions',
  url: 'https://github.test/JohnStrunk/oats/actions/runs/5849201736',
  buildNumber: '5849201736',
  git: Object.freeze({
    remote: 'https://github.test/JohnStrunk/oats.git',
    revision: '0123456789abcdef0123456789abcdef01234567',
    branch: 'profile-fixture-branch',
  }),
})

export function createProfileCommandFixture() {
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const dir = mkdtempSync(join(tempRoot, 'oats-profile-fixture-'))
  try {
    const givenSteps = join(dir, 'features/steps/given')
    mkdirSync(givenSteps, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      private: true,
      type: 'module',
      scripts: { 'test:features': 'cucumber-js' },
    }, null, 2) + '\n')
    writeFileSync(join(dir, 'cucumber.js'), "export default { import: ['features/steps/{given,when,then}/**/*.js'] }\n")
    for (const component of new Set(PROFILE_FIXTURE_SCENARIOS.map(scenario => scenario.component))) {
      const featureDir = join(dir, 'features', component)
      mkdirSync(featureDir, { recursive: true })
      const scenarios = PROFILE_FIXTURE_SCENARIOS.filter(scenario => scenario.component === component)
      const source = `@component:${component}
Feature: On-demand profile fixture for ${component}

${scenarios.map(scenario => `  Scenario: ${scenario.name}
    Given the timed profile fixture scenario "${scenario.name}" executes
`).join('\n')}`
      writeFileSync(join(featureDir, 'profile-fixture.feature'), source)
    }
    writeFileSync(join(givenSteps, 'profile-fixture.js'), `import { appendFileSync } from 'node:fs'
import { After, AfterStep, Before, BeforeStep, Given } from '@cucumber/cucumber'

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

Before(async function () { await wait(40) })
After(async function () { await wait(40) })
BeforeStep(async function () { await wait(60) })
AfterStep(async function () { await wait(60) })

Given('the timed profile fixture scenario {string} executes', async function (scenarioName) {
  await wait(120)
  appendFileSync('profile-fixture-executions.log', scenarioName + '\\n')
})
`)
    symlinkSync(join(REPOSITORY_ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir')
    symlinkSync(join(REPOSITORY_ROOT, 'scripts'), join(dir, 'scripts'), 'dir')
    return { dir, scenarios: PROFILE_FIXTURE_SCENARIOS.map(scenario => ({ ...scenario })) }
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}

export function profileFixtureEnvironment(dir) {
  return {
    ...sandboxEnvironment(dir),
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_SERVER_URL: 'https://github.test',
    GITHUB_REPOSITORY: 'JohnStrunk/oats',
    GITHUB_RUN_ID: PROFILE_FIXTURE_CI_CONTEXT.buildNumber,
    GITHUB_SHA: PROFILE_FIXTURE_CI_CONTEXT.git.revision,
    GITHUB_HEAD_REF: PROFILE_FIXTURE_CI_CONTEXT.git.branch,
  }
}

export function profileFixtureExecutions(fixture) {
  const path = join(fixture.dir, PROBE_FILE)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
}

export function resetProfileFixtureExecutions(fixture) {
  writeFileSync(join(fixture.dir, PROBE_FILE), '')
}

function timestampMilliseconds(timestamp) {
  return Number(timestamp.seconds) * 1000 + Number(timestamp.nanos) / 1e6
}

function durationMilliseconds(duration) {
  return Number(duration.seconds) * 1000 + Number(duration.nanos) / 1e6
}

function cucumberEnvelopes(output) {
  const envelopes = []
  for (const line of output.split(/\r?\n/)) {
    try {
      envelopes.push(JSON.parse(line))
    } catch {
      // npm's command banner is not a Cucumber message.
    }
  }
  return envelopes
}

export function profileFixtureMessageContextFromMessages(output) {
  const meta = cucumberEnvelopes(output).find(envelope => envelope.meta)?.meta
  if (!meta) return null
  return {
    cucumberVersion: meta.implementation?.version,
    nodeVersion: meta.runtime?.version,
    osName: meta.os?.name,
    osRelease: meta.os?.version,
    cpuArchitecture: meta.cpu?.name,
    ci: meta.ci,
  }
}

export function profileFixtureRunWindowMillisecondsFromMessages(output) {
  const envelopes = cucumberEnvelopes(output)
  const started = envelopes.find(envelope => envelope.testRunStarted)?.testRunStarted
  const finished = envelopes.find(envelope => envelope.testRunFinished)?.testRunFinished
  if (!started || !finished) return null
  return timestampMilliseconds(finished.timestamp) - timestampMilliseconds(started.timestamp)
}

// Keep this control aggregation independent of scripts/profile-report.js so
// routine Cucumber evidence cannot reuse the production mapping tautologically.
export function profileFixtureScenarioMetricsFromMessages(output) {
  const envelopes = cucumberEnvelopes(output)

  const testCases = new Map(envelopes.filter(envelope => envelope.testCase)
    .map(envelope => [envelope.testCase.id, envelope.testCase]))
  const pickles = new Map(envelopes.filter(envelope => envelope.pickle)
    .map(envelope => [envelope.pickle.id, envelope.pickle]))
  const hooks = new Map(envelopes.filter(envelope => envelope.hook)
    .map(envelope => [envelope.hook.id, envelope.hook.type]))
  const started = new Map(envelopes.filter(envelope => envelope.testCaseStarted)
    .map(envelope => [envelope.testCaseStarted.id, envelope.testCaseStarted]))
  const stepResults = new Map()
  for (const envelope of envelopes) {
    const result = envelope.testStepFinished
    if (!result) continue
    const results = stepResults.get(result.testCaseStartedId) ?? []
    results.push(result)
    stepResults.set(result.testCaseStartedId, results)
  }

  const metrics = []
  for (const envelope of envelopes) {
    const finished = envelope.testCaseFinished
    if (!finished) continue
    const attempt = started.get(finished.testCaseStartedId)
    const testCase = attempt && testCases.get(attempt.testCaseId)
    const pickle = testCase && pickles.get(testCase.pickleId)
    if (!attempt || !testCase || !pickle) continue

    const testSteps = new Map(testCase.testSteps.map(step => [step.id, step]))
    let stepMilliseconds = 0
    let scenarioHookMilliseconds = 0
    for (const result of stepResults.get(finished.testCaseStartedId) ?? []) {
      const testStep = testSteps.get(result.testStepId)
      if (!testStep) continue
      const duration = durationMilliseconds(result.testStepResult.duration)
      if (testStep.pickleStepId) {
        stepMilliseconds += duration
      } else if (['BEFORE_TEST_CASE', 'AFTER_TEST_CASE'].includes(hooks.get(testStep.hookId))) {
        scenarioHookMilliseconds += duration
      }
    }

    const componentTag = pickle.tags?.find(tag => tag.name.startsWith('@component:'))?.name
    metrics.push({
      name: pickle.name,
      component: componentTag?.slice('@component:'.length),
      elapsedMilliseconds: timestampMilliseconds(finished.timestamp) - timestampMilliseconds(attempt.timestamp),
      stepMilliseconds,
      scenarioHookMilliseconds,
    })
  }
  return metrics
}

export function profileReportLines(result) {
  return `${result.stdout}\n${result.stderr}`.replace(ANSI_ESCAPE, '').split(/\r?\n/)
}

export function profileDurationMilliseconds(line) {
  const tokens = [...line.matchAll(DURATION_TOKEN)]
  if (tokens.length) {
    let total = 0
    for (const [, rawValue, unit] of tokens) {
      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < 0) return null
      const normalized = unit.toLowerCase()
      const scale = /^(?:ns|nanoseconds?)$/.test(normalized) ? 1e-6
        : /^(?:[µμ]s|us|microseconds?)$/.test(normalized) ? 1e-3
          : /^(?:ms|msec|milliseconds?)$/.test(normalized) ? 1
            : /^(?:s|sec(?:onds?)?|secs?)$/.test(normalized) ? 1e3
              : /^(?:m|min(?:utes?)?|mins?)$/.test(normalized) ? 60e3
                : 60 * 60e3
      total += value * scale
    }
    return total
  }

  const clock = line.match(CLOCK_DURATION)
  if (!clock || clock[1] === '-') return null
  const hours = clock[2] === undefined ? 0 : Number(clock[2])
  const minutes = Number(clock[3])
  const seconds = Number(clock[4])
  const fraction = clock[5] === undefined ? 0 : Number(`0.${clock[5]}`)
  return (hours * 3600 + minutes * 60 + seconds + fraction) * 1000
}

After(function () {
  if (this.profileFixture?.dir) rmSync(this.profileFixture.dir, { recursive: true, force: true })
})
