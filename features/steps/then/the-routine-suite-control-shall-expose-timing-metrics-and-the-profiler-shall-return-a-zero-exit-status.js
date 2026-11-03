import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { readFileSync } from 'node:fs'
import { PROFILE_FIXTURE_CI_CONTEXT } from '../profile-command-support.js'

function expectedCucumberVersion() {
  const packageManifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
  const pinnedVersion = packageManifest.devDependencies?.['@cucumber/cucumber']
  if (typeof pinnedVersion === 'string') return pinnedVersion

  const installedPackage = JSON.parse(readFileSync(
    new URL('../../../node_modules/@cucumber/cucumber/package.json', import.meta.url),
    'utf8',
  ))
  if (typeof installedPackage.version !== 'string') {
    throw new Error('The installed @cucumber/cucumber package does not include a version')
  }
  return installedPackage.version
}

Then('the routine-suite control shall expose timing metrics and the profiler shall return a zero exit status', function () {
  const cucumberVersion = expectedCucumberVersion()
  const control = this.routineSuiteResult
  assert.ok(control, 'The independent routine-suite timing control did not produce a process result')
  assert.equal(control.timedOut, false, 'The independent routine-suite timing control timed out')
  assert.equal(control.signal, null, `The routine-suite timing control terminated by ${control.signal}`)
  assert.equal(control.status, 0, `The routine-suite timing control failed:\n${control.stdout}\n${control.stderr}`)

  assert.equal(this.routineScenarioMetrics.length, this.profileFixture.scenarios.length,
    `The Cucumber message run reported ${this.routineScenarioMetrics.length} scenarios, expected ${this.profileFixture.scenarios.length}`)
  assert.equal(this.routineMessageContext?.cucumberVersion, cucumberVersion,
    `The control stream did not identify Cucumber.js ${cucumberVersion}`)
  assert.ok(this.routineMessageContext?.nodeVersion, 'The control stream omitted the Node runtime version')
  assert.ok(this.routineMessageContext?.osName && this.routineMessageContext?.osRelease && this.routineMessageContext?.cpuArchitecture,
    'The control stream omitted OS or CPU metadata')
  assert.deepEqual(this.routineMessageContext?.ci, PROFILE_FIXTURE_CI_CONTEXT,
    'The Cucumber message protocol did not expose the synthetic CI provider/build/Git context')
  assert.ok(Number.isFinite(this.routineRunWindowMilliseconds) && this.routineRunWindowMilliseconds >= 0,
    'The control stream omitted a nonnegative Cucumber test-run window')
  assert.ok(Number.isFinite(this.routineSuiteMilliseconds) && this.routineSuiteMilliseconds >= 0,
    'The independent command wall time was not a nonnegative measurement')

  for (const scenario of this.profileFixture.scenarios) {
    const metrics = this.routineScenarioMetrics.find(candidate => candidate.name === scenario.name)
    assert.ok(metrics, `Cucumber messages omitted fixture scenario ${scenario.name}`)
    assert.equal(metrics.component, scenario.component, `Cucumber messages assigned ${scenario.name} to the wrong component`)
    assert.ok(Number.isFinite(metrics.elapsedMilliseconds) && metrics.elapsedMilliseconds >= 0,
      `Cucumber messages omitted a nonnegative elapsed time for ${scenario.name}`)
    assert.ok(metrics.stepMilliseconds >= 210, `Cucumber messages did not include both fixture step-hook costs for ${scenario.name}`)
    assert.ok(metrics.scenarioHookMilliseconds >= 70, `Cucumber messages omitted before/after scenario-hook costs for ${scenario.name}`)
  }

  const result = this.profileResult
  assert.ok(result, 'The on-demand profiler did not produce a process result')
  assert.equal(result.timedOut, false, 'The on-demand profiler timed out')
  assert.equal(result.signal, null, `The on-demand profiler terminated by ${result.signal}`)
  assert.equal(result.status, 0, `The on-demand profiler failed:\n${result.stdout}\n${result.stderr}`)
})
