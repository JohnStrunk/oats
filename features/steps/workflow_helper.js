import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Lexer, Parser, Evaluator, data } from '@actions/expressions'
import { parse } from 'yaml'

export const getRepoRoot = () => fileURLToPath(new URL('../../', import.meta.url))

export function loadCiWorkflow() {
  const path = new URL('../../.github/workflows/ci.yml', import.meta.url)
  const data = parse(readFileSync(path, 'utf8'))
  assert(data && typeof data === 'object' && !Array.isArray(data), `Expected YAML mapping in ${path}`)
  return data
}

export function getWorkflowTriggers(workflow) {
  const triggers = workflow.on
  return triggers && typeof triggers === 'object' ? triggers : {}
}

export function findSuccessfulCiJob(workflow) {
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    if (job && typeof job === 'object' && (job.name === 'Successful CI' || id === 'successful-ci')) return [id, job]
  }
  throw new assert.AssertionError({ message: "No job named 'Successful CI' found in CI workflow" })
}

function configuredCheckIds(workflow) {
  return Object.entries(workflow.jobs ?? {}).filter(([id, candidate]) => {
    const description = `${id} ${candidate?.name ?? ''}`.toLowerCase()
    return description.includes('test') || description.includes('lint')
  }).map(([id]) => id)
}

// Outline examples represent hypothetical workflow topologies. Keep the real
// gate intact, but give it exactly the generated prerequisite jobs.
export function workflowWithSyntheticChecks(workflow, counts) {
  assert(Number.isSafeInteger(counts.test) && counts.test >= 0, 'Invalid synthetic test job count')
  assert(Number.isSafeInteger(counts.lint) && counts.lint >= 0, 'Invalid synthetic lint job count')
  const fixture = structuredClone(workflow)
  const [, gate] = findSuccessfulCiJob(fixture)
  for (const id of configuredCheckIds(fixture)) delete fixture.jobs[id]
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
  const needs = typeof job.needs === 'string' ? [job.needs] : job.needs
  assert(Array.isArray(needs) && needs.length > 0, `'Successful CI' job must have non-empty 'needs' dependency list, got ${JSON.stringify(needs)}`)
  assert(needs.every(id => typeof id === 'string' && Object.hasOwn(workflow.jobs ?? {}, id)), 'Every Successful CI prerequisite must be a configured job')
  const configuredChecks = configuredCheckIds(workflow)
  assert(configuredChecks.every(id => needs.includes(id)), `Successful CI must depend on all configured test and lint jobs: ${configuredChecks}`)
  assert(/^(?:always\(\)|\$\{\{\s*always\(\)\s*\}\})$/.test(String(job.if ?? '').trim()), "'Successful CI' job must specify 'if: always()'")
  assert(!workflow.defaults && !job.defaults && !job.env && !job['continue-on-error'], 'Unsupported Successful CI job execution settings')
  assert(Array.isArray(job.steps) && job.steps.length === 1, 'Expected one Successful CI gate step')
  const [step] = job.steps
  assert(typeof step.run === 'string' && !step.shell && !step.if && !step.env && !step['continue-on-error'] && !step.uses, 'Unsupported Successful CI gate step')

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
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const directory = mkdtempSync(join(tempRoot, 'oats-ci-gate-'))
  let execution
  try {
    const scriptFile = join(directory, 'gate.sh')
    writeFileSync(scriptFile, script, { mode: 0o600, flag: 'wx' })
    execution = spawnSync('bash', ['-e', scriptFile], {
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: getRepoRoot(), timeout: 5000, maxBuffer: 1024 * 1024,
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
