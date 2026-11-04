// Pure Cucumber-message aggregation and report formatting for
// scripts/profile-features.js. Kept separate from the CLI so the message
// mapping can be unit tested without spawning npm.

// Cucumber 13.3.0 consumes BeforeStep/AfterStep hook time inside the enclosing
// Gherkin step result, so those hook results are deliberately not reported on
// their own. Only scenario-level hooks have a separately represented duration.
const SCENARIO_HOOK_TYPES = new Set(['BEFORE_TEST_CASE', 'AFTER_TEST_CASE'])
const COMPONENT_TAG_PREFIX = '@component:'
const UNASSIGNED_COMPONENT = 'unassigned'
const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/gu
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/gu

export function sanitizeReportText(value) {
  return String(value)
    .replace(ANSI_ESCAPE, '')
    .replace(CONTROL_CHARACTER, character => `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`)
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//iu
// Bare `git@host:path` remotes name the SSH user, not a credential, so they are
// the one unparseable form that is safe to echo verbatim.
const SAFE_SCP_REMOTE = /^git@[a-z0-9.-]+:[^\s?#@]+$/iu
const REDACTED_URL_PLACEHOLDER = '[redacted URL]'

// Reports get pasted into issues and PRs, so links are reduced to the part
// that identifies the build or repository: no userinfo, query, or fragment.
export function redactReportUrl(value) {
  const text = String(value).trim()
  const url = parseAbsoluteUrl(text)
  if (url) {
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return sanitizeReportText(url.toString())
  }
  if (SAFE_SCP_REMOTE.test(text)) return sanitizeReportText(text)
  // A malformed value cannot be redacted structurally: `?`/`#` can appear
  // before userinfo, so any partial guess may echo credentials. Fail closed.
  return REDACTED_URL_PLACEHOLDER
}

function parseAbsoluteUrl(text) {
  if (!ABSOLUTE_URL.test(text)) return null
  try {
    return new URL(text)
  } catch {
    return null
  }
}

function timestampMilliseconds(timestamp) {
  return Number(timestamp?.seconds ?? 0) * 1000 + Number(timestamp?.nanos ?? 0) / 1e6
}

function durationMilliseconds(duration) {
  return Number(duration?.seconds ?? 0) * 1000 + Number(duration?.nanos ?? 0) / 1e6
}

function roundMilliseconds(value) {
  const finite = Number.isFinite(value) ? value : 0
  return Math.max(0, Math.round(finite * 10) / 10)
}

function formatMilliseconds(value) {
  return `${roundMilliseconds(value).toFixed(1)} ms`
}

function indexById(envelopes, envelopeKey) {
  const index = new Map()
  for (const envelope of envelopes) {
    const item = envelope[envelopeKey]
    if (item?.id) index.set(item.id, item)
  }
  return index
}

// A successful run must produce a complete NDJSON stream; a failing run may
// have been interrupted mid-line, so callers can parse it leniently to show
// whatever profile is available.
export function parseCucumberMessages(text, { strict = false } = {}) {
  const envelopes = []
  for (const [index, line] of String(text).split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      // Do not echo the line: message content can include untrusted names.
      if (strict) throw new Error(`Cucumber message line ${index + 1} is not valid JSON`)
      continue
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      if (strict) throw new Error(`Cucumber message line ${index + 1} is not a Cucumber message envelope`)
      continue
    }
    envelopes.push(parsed)
  }
  if (strict && envelopes.length === 0) throw new Error('Cucumber message report is empty')
  return envelopes
}

export function aggregateScenarioTimings(envelopes) {
  const meta = envelopes.find(envelope => envelope.meta)?.meta ?? null
  const testCases = indexById(envelopes, 'testCase')
  const pickles = indexById(envelopes, 'pickle')
  const hooks = indexById(envelopes, 'hook')
  const startedCases = indexById(envelopes, 'testCaseStarted')

  const stepResultsByAttempt = new Map()
  for (const envelope of envelopes) {
    const finished = envelope.testStepFinished
    if (!finished?.testCaseStartedId) continue
    const results = stepResultsByAttempt.get(finished.testCaseStartedId) ?? []
    results.push(finished)
    stepResultsByAttempt.set(finished.testCaseStartedId, results)
  }

  const scenarios = []
  for (const envelope of envelopes) {
    const finishedCase = envelope.testCaseFinished
    if (!finishedCase?.testCaseStartedId) continue
    const started = startedCases.get(finishedCase.testCaseStartedId)
    const testCase = started && testCases.get(started.testCaseId)
    const pickle = testCase && pickles.get(testCase.pickleId)
    if (!started || !testCase || !pickle) continue

    const testSteps = new Map((testCase.testSteps ?? []).map(step => [step.id, step]))
    let stepMilliseconds = 0
    let scenarioHookMilliseconds = 0
    for (const finishedStep of stepResultsByAttempt.get(finishedCase.testCaseStartedId) ?? []) {
      const testStep = testSteps.get(finishedStep.testStepId)
      if (!testStep) continue
      const milliseconds = Math.max(0, durationMilliseconds(finishedStep.testStepResult?.duration))
      if (testStep.pickleStepId) {
        // BeforeStep/AfterStep costs are already folded into this duration.
        stepMilliseconds += milliseconds
      } else if (SCENARIO_HOOK_TYPES.has(hooks.get(testStep.hookId)?.type)) {
        scenarioHookMilliseconds += milliseconds
      }
    }

    const componentTag = pickle.tags?.find(tag => tag.name?.startsWith(COMPONENT_TAG_PREFIX))?.name
    scenarios.push({
      name: sanitizeReportText(pickle.name ?? '(unnamed scenario)'),
      component: componentTag
        ? sanitizeReportText(componentTag.slice(COMPONENT_TAG_PREFIX.length))
        : UNASSIGNED_COMPONENT,
      elapsedMilliseconds: Math.max(0,
        timestampMilliseconds(finishedCase.timestamp) - timestampMilliseconds(started.timestamp)),
      stepMilliseconds,
      scenarioHookMilliseconds,
    })
  }
  return { meta, scenarios }
}

function runtimeContextLines(meta) {
  const lines = ['Runtime context']
  const implementation = meta?.implementation
  const cucumber = implementation?.version ?? 'unknown'
  lines.push(`  Cucumber.js: ${sanitizeReportText(cucumber)}`
    + (implementation?.name ? ` (${sanitizeReportText(implementation.name)})` : ''))
  lines.push(`  Node.js: ${sanitizeReportText(meta?.runtime?.version ?? 'unknown')}`)
  lines.push(`  OS: ${sanitizeReportText(meta?.os?.name ?? 'unknown')}`
    + ` (release ${sanitizeReportText(meta?.os?.version ?? 'unknown')})`)
  lines.push(`  CPU architecture: ${sanitizeReportText(meta?.cpu?.name ?? 'unknown')}`)

  const ci = meta?.ci
  if (ci) {
    lines.push(`  CI provider: ${sanitizeReportText(ci.name ?? 'unknown')}`)
    if (ci.url) lines.push(`  CI build URL: ${redactReportUrl(ci.url)}`)
    if (ci.buildNumber) lines.push(`  CI build number: ${sanitizeReportText(ci.buildNumber)}`)
    if (ci.git?.remote) lines.push(`  CI Git remote: ${redactReportUrl(ci.git.remote)}`)
    if (ci.git?.revision) lines.push(`  CI Git revision: ${sanitizeReportText(ci.git.revision)}`)
    if (ci.git?.branch) lines.push(`  CI Git branch: ${sanitizeReportText(ci.git.branch)}`)
    if (ci.git?.tag) lines.push(`  CI Git tag: ${sanitizeReportText(ci.git.tag)}`)
  } else {
    lines.push('  CI provider: not detected in this environment')
  }
  lines.push('  Runner image/label: not reported by Cucumber messages; read it from the CI job logs.')
  return lines
}

function componentTotals(scenarios) {
  const totals = new Map()
  for (const scenario of scenarios) {
    const total = totals.get(scenario.component) ?? { milliseconds: 0, count: 0 }
    total.milliseconds += scenario.elapsedMilliseconds
    total.count += 1
    totals.set(scenario.component, total)
  }
  return totals
}

export function formatProfileReport({ meta, scenarios, wallMilliseconds, exit }) {
  // Aggregate from the displayed (rounded) per-scenario values so the printed
  // residual equals the printed suite time minus the printed scenario times.
  const displayed = scenarios.map(scenario => ({
    ...scenario,
    elapsedMilliseconds: roundMilliseconds(scenario.elapsedMilliseconds),
    stepMilliseconds: roundMilliseconds(scenario.stepMilliseconds),
    scenarioHookMilliseconds: roundMilliseconds(scenario.scenarioHookMilliseconds),
  }))
  const suiteMilliseconds = roundMilliseconds(wallMilliseconds)
  const scenarioMilliseconds = roundMilliseconds(
    displayed.reduce((total, scenario) => total + scenario.elapsedMilliseconds, 0))
  const residualMilliseconds = roundMilliseconds(Math.max(0, suiteMilliseconds - scenarioMilliseconds))

  const lines = ['Feature-suite profile report']
  if (exit) {
    const outcome = exit.signal ? `signal ${exit.signal}` : `status ${exit.code}`
    lines.push(`  Test command exit: ${outcome}`)
  }
  lines.push(...runtimeContextLines(meta))
  lines.push('')
  lines.push(`Complete feature-suite elapsed: ${formatMilliseconds(suiteMilliseconds)}`)
  lines.push(`Scenario elapsed total: ${formatMilliseconds(scenarioMilliseconds)}`)
  lines.push(`Residual setup/framework overhead: ${formatMilliseconds(residualMilliseconds)}`)
  lines.push('')
  lines.push(`Note: In Cucumber.js ${sanitizeReportText(meta?.implementation?.version ?? 'unknown')},`
    + ' BeforeStep and AfterStep hook time is folded into the Gherkin step result and is included'
    + ' in each Gherkin step time; scenario hook time is measured separately.')
  lines.push('')
  lines.push('Per-scenario timings')
  for (const scenario of displayed) {
    lines.push(`Scenario elapsed ${formatMilliseconds(scenario.elapsedMilliseconds)}`
      + ` [component: ${scenario.component}] ${scenario.name}`)
    lines.push(`  Gherkin step time ${formatMilliseconds(scenario.stepMilliseconds)} - ${scenario.name}`)
    lines.push(`  Scenario hook time ${formatMilliseconds(scenario.scenarioHookMilliseconds)} - ${scenario.name}`)
  }
  lines.push('')
  lines.push('Component totals')
  for (const [component, total] of componentTotals(displayed)) {
    lines.push(`Component total [${component}] ${formatMilliseconds(total.milliseconds)}`
      + ` (${total.count} scenario${total.count === 1 ? '' : 's'})`)
  }
  return lines.join('\n')
}
