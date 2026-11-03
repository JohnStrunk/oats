import { When } from '@cucumber/cucumber'
import { PROCESS_MAX_CLEANUP_MS, runProcess } from '../../tests/migration-process.js'
import {
  profileFixtureEnvironment,
  profileFixtureMessageContextFromMessages,
  profileFixtureRunWindowMillisecondsFromMessages,
  profileFixtureScenarioMetricsFromMessages,
  resetProfileFixtureExecutions,
} from '../profile-command-support.js'

const PROFILE_FIXTURE_RUN_TIMEOUT_MS = 30_000
const PROFILE_FIXTURE_RUN_COUNT = 2
const PROFILE_FIXTURE_STEP_MARGIN_MS = 10_000
// Both serial runners can hit their deadlines and bounded cleanup, so the step
// timeout covers both budgets plus a margin.
const PROFILE_FIXTURE_STEP_TIMEOUT_MS = PROFILE_FIXTURE_RUN_COUNT *
  (PROFILE_FIXTURE_RUN_TIMEOUT_MS + PROCESS_MAX_CLEANUP_MS) + PROFILE_FIXTURE_STEP_MARGIN_MS

When('the contributor runs the on-demand profiler in that checkout', { timeout: PROFILE_FIXTURE_STEP_TIMEOUT_MS }, async function () {
  const fixtureOptions = {
    cwd: this.profileFixture.dir,
    env: profileFixtureEnvironment(this.profileFixture.dir),
    timeout: PROFILE_FIXTURE_RUN_TIMEOUT_MS,
  }

  // Time the unprofiled fixture suite separately as an independent wall-clock oracle.
  const controlStarted = process.hrtime.bigint()
  this.routineSuiteResult = await runProcess('npm', ['run', 'test:features', '--', '--format', 'message'], fixtureOptions)
  this.routineSuiteMilliseconds = Number(process.hrtime.bigint() - controlStarted) / 1e6
  this.routineScenarioMetrics = profileFixtureScenarioMetricsFromMessages(this.routineSuiteResult.stdout)
  this.routineMessageContext = profileFixtureMessageContextFromMessages(this.routineSuiteResult.stdout)
  this.routineRunWindowMilliseconds = profileFixtureRunWindowMillisecondsFromMessages(this.routineSuiteResult.stdout)
  resetProfileFixtureExecutions(this.profileFixture)

  const started = process.hrtime.bigint()
  this.profileResult = await runProcess(process.execPath, ['scripts/profile-features.js'], fixtureOptions)
  this.profileInvocationMilliseconds = Number(process.hrtime.bigint() - started) / 1e6
})
