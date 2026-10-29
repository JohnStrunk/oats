import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Lexer, Parser, Evaluator, data } from '@actions/expressions'
import { parse } from 'yaml'
export { evaluateCiScheduling } from './ci_scheduling.js'
export { linterAvailable, runCiLinter } from './ci_linter.js'

const CI_LINT_JOB_IDS = {
  markdownlint: 'lint-markdown',
  yamllint: 'lint-yaml-and-workflows',
  actionlint: 'lint-yaml-and-workflows',
  shellcheck: 'lint-shell',
}
const UNSUPPORTED_STEP_SETTINGS = ['if', 'continue-on-error', 'shell', 'env', 'working-directory']
const UNSUPPORTED_EXECUTION_SETTINGS = ['container', 'defaults', 'env']
const UBUNTU_RUNNER = /^ubuntu-(?:latest|\d{2}\.\d{2}(?:-arm)?)$/

export const getRepoRoot = () => fileURLToPath(new URL('../../', import.meta.url))

export function loadCiWorkflow() {
  const path = new URL('../../.github/workflows/ci.yml', import.meta.url)
  const data = parse(readFileSync(path, 'utf8'))
  assert(data && typeof data === 'object' && !Array.isArray(data), `Expected YAML mapping in ${path}`)
  return data
}

// Both local executors run steps with `bash -e`. That matches GitHub's implicit
// shell only for a job that runs directly on a Linux runner. A different
// runner, container, or shell/environment override would change the interpreter
// or its inputs, so reject it instead of reporting a local result that CI would
// not reproduce.
function assertImplicitLinuxBash(workflow, job, label) {
  assert(!UNSUPPORTED_EXECUTION_SETTINGS.some(key => Object.hasOwn(workflow, key)), `Unsupported ${label} workflow execution settings`)
  assert(![...UNSUPPORTED_EXECUTION_SETTINGS, 'continue-on-error'].some(key => Object.hasOwn(job, key)), `Unsupported ${label} job execution settings`)
  const runner = job['runs-on']
  assert(typeof runner === 'string' && UBUNTU_RUNNER.test(runner), `${label} must run directly on a supported Ubuntu runner, got ${JSON.stringify(runner)}`)
}

function findLinterStep(job, kind) {
  const command = `node scripts/ci-lint.js ${kind}`
  const steps = job.steps.filter(step => step?.run === command)
  assert.equal(steps.length, 1, `Expected CI to execute ${command} exactly once`)
  return steps[0]
}

function runWorkflowCommand(command) {
  const result = spawnSync('bash', ['-e', '-c', command], { cwd: getRepoRoot(), encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: (result.stderr ?? '') + (result.error ? String(result.error) : '') }
}

// Execute exactly the linter command configured in the checked-in workflow.
// Reject conditional or modified steps instead of silently testing a different
// command from the one CI runs. Tests may pass a mutated workflow to exercise
// those rejections.
export function runCiWorkflowLinter(kind, workflow = loadCiWorkflow()) {
  assert(Object.hasOwn(CI_LINT_JOB_IDS, kind), `Unknown linter: ${kind}`)
  const job = workflow?.jobs?.[CI_LINT_JOB_IDS[kind]]
  assert(job && typeof job === 'object' && Array.isArray(job.steps), `Missing CI lint job for ${kind}`)
  const step = findLinterStep(job, kind)
  assert(!UNSUPPORTED_STEP_SETTINGS.some(key => Object.hasOwn(step, key)), `Unsupported CI linter step: ${kind}`)
  assertImplicitLinuxBash(workflow, job, `CI linter ${kind}`)
  return runWorkflowCommand(step.run)
}

export function findSuccessfulCiJob(workflow) {
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    if (job && typeof job === 'object' && (job.name === 'Successful CI' || id === 'successful-ci')) return [id, job]
  }
  throw new assert.AssertionError({ message: "No job named 'Successful CI' found in CI workflow" })
}

// The aggregate gate's `needs` list is the authoritative set of required
// checks. Name-based discovery would silently miss a renamed check, so every
// job other than the gate must also be declared as a prerequisite.
export function requiredCiJobIds(workflow) {
  const [gateId, gate] = findSuccessfulCiJob(workflow)
  const jobs = workflow.jobs ?? {}
  const needs = gate.needs === undefined ? [] : typeof gate.needs === 'string' ? [gate.needs] : gate.needs
  assert(Array.isArray(needs) && needs.length > 0, `'Successful CI' job must have non-empty 'needs' dependency list, got ${JSON.stringify(needs)}`)
  assert(needs.every(id => typeof id === 'string' && id !== gateId && Object.hasOwn(jobs, id)), 'Every Successful CI prerequisite must be a configured non-gate job')
  assert.equal(new Set(needs).size, needs.length, 'Successful CI prerequisites must be unique')
  const unrequired = Object.keys(jobs).filter(id => id !== gateId && !needs.includes(id))
  assert.equal(unrequired.length, 0, `Every non-gate job must be a Successful CI prerequisite: ${unrequired}`)
  return needs
}

// Outline examples represent hypothetical workflow topologies. Keep the real
// gate intact, but give it exactly the generated prerequisite jobs.
export function workflowWithSyntheticChecks(workflow, counts) {
  assert(Number.isSafeInteger(counts.test) && counts.test >= 0, 'Invalid synthetic test job count')
  assert(Number.isSafeInteger(counts.lint) && counts.lint >= 0, 'Invalid synthetic lint job count')
  const fixture = structuredClone(workflow)
  const [gateId, gate] = findSuccessfulCiJob(fixture)
  for (const id of Object.keys(fixture.jobs ?? {})) if (id !== gateId) delete fixture.jobs[id]
  const needs = []
  for (const kind of ['test', 'lint']) {
    for (let index = 0; index < counts[kind]; index++) {
      const id = `${kind}_job_${index}`
      assert(!Object.hasOwn(fixture.jobs, id), `Synthetic job conflicts with configured job: ${id}`)
      fixture.jobs[id] = { name: `${kind} job ${index}`, 'runs-on': 'ubuntu-latest', steps: [{ run: 'true' }] }
      needs.push(id)
    }
  }
  gate.needs = needs
  return fixture
}

// Use GitHub's expression implementation with only the needs context available.
// The resulting value must be Boolean before it can be substituted into shell.
export function evaluateGateExpression(expression, results) {
  const needs = new data.Dictionary()
  for (const [id, result] of Object.entries(results)) {
    needs.add(id, new data.Dictionary({ key: 'result', value: new data.StringData(result) }))
  }
  const context = new data.Dictionary({ key: 'needs', value: needs })
  const tokens = new Lexer(expression).lex().tokens
  const parsed = new Parser(tokens, ['needs'], []).parse()
  const value = new Evaluator(parsed, context).evaluate()
  assert.equal(value.kind, data.Kind.Boolean, 'Gate expression must evaluate to a Boolean')
  return value.value
}

// This runs the checked-in gate shell, not a separately reimplemented gate.
// Only a constrained context is provided; nothing from the ambient GitHub
// context, secrets, or arbitrary expression output is injected into the shell.
export function executeSuccessfulCiGate(workflow, suppliedResults) {
  const [, job] = findSuccessfulCiJob(workflow)
  const needs = requiredCiJobIds(workflow)
  assert(/^(?:always\(\)|\$\{\{\s*always\(\)\s*\}\})$/.test(String(job.if ?? '').trim()), "'Successful CI' job must specify 'if: always()'")
  assertImplicitLinuxBash(workflow, job, "'Successful CI'")
  // Additional steps (for example, a checkout) could populate or modify the
  // empty workspace modeled below, so require exactly the single gate command.
  assert(Array.isArray(job.steps) && job.steps.length === 1, 'Expected one Successful CI gate step')
  const [step] = job.steps
  assert(typeof step?.run === 'string', 'Expected a Successful CI gate run step')
  // A step-level override such as `working-directory` would make the command
  // run somewhere other than where this executor runs it, so reject it rather
  // than report a result CI would not reproduce.
  const unsupportedSetting = [...UNSUPPORTED_STEP_SETTINGS, 'uses'].find(key => Object.hasOwn(step, key))
  assert.equal(unsupportedSetting, undefined, `Unsupported Successful CI gate step setting: ${unsupportedSetting}`)

  // Unspecified configured prerequisites are successful.
  const results = Object.fromEntries(needs.map(id => [id, 'success']))
  for (const [id, status] of Object.entries(suppliedResults)) {
    assert(needs.includes(id), `Result supplied for a job outside Successful CI needs: ${id}`)
    assert(['success', 'failure', 'cancelled', 'skipped'].includes(status), `Unsupported prerequisite result: ${status}`)
    results[id] = status
  }
  const script = step.run.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression) => String(evaluateGateExpression(expression, results)))
  assert(!script.includes('${{'), 'Unclosed GitHub Actions gate expression')
  // GitHub's implicit Linux shell uses `bash -e {0}`. Explicit `shell: bash`
  // has different flags (including pipefail), and is rejected above.
  // The Successful CI job has no checkout step, so its workspace is empty.
  // Model that instead of inheriting the repository working directory, which
  // would let a gate that depends on checked-in files falsely pass locally.
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const directory = mkdtempSync(join(tempRoot, 'oats-ci-gate-'))
  const workspace = join(directory, 'workspace')
  let execution
  try {
    mkdirSync(workspace)
    // GitHub writes the step script outside GITHUB_WORKSPACE, so keep it out
    // of the modeled workspace as well.
    const scriptFile = join(directory, 'gate.sh')
    writeFileSync(scriptFile, script, { mode: 0o600, flag: 'wx' })
    execution = spawnSync('bash', ['-e', scriptFile], {
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: workspace, timeout: 5000, maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C' },
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
  assert.ifError(execution.error)
  assert.equal(execution.signal, null, `Gate script terminated by signal ${execution.signal}`)
  assert(Number.isInteger(execution.status), 'Gate script did not report an exit status')
  return execution.status === 0 ? 'success' : 'failure'
}
