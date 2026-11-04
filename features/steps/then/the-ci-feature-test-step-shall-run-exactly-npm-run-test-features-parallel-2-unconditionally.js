import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fc from 'fast-check'
import { Then } from '@cucumber/cucumber'
import { getRepoRoot } from '../workflow_helper.js'

// The complete-feature-suite invocation required in CI. Comparison is on
// parsed shell words, so quoting or extra whitespace cannot hide a different
// command and a substring such as `--parallel 20` cannot satisfy the rule.
const FEATURE_SUITE_TOKENS = ['npm', 'run', 'test:features']
const CI_FEATURE_SUITE_TOKENS = [...FEATURE_SUITE_TOKENS, '--', '--parallel', '2']
// Unquoted shell control characters would let the step run additional commands
// (for example `npm run test:features && npm run test:unit`), so the checked
// command must be a single plain command.
const SHELL_CONTROL_CHARACTERS = new Set([';', '&', '|', '<', '>', '$', '`', '(', ')', '{', '}', '#', '*', '?', '[', ']'])

function shellWords(command, label) {
  assert.equal(typeof command, 'string', `${label} must be a shell command string`)
  const text = command.trim()
  assert.ok(text.length > 0, `${label} must not be empty`)
  const words = []
  let word = null
  let index = 0
  while (index < text.length) {
    const character = text[index]
    if (character === '\n' || character === '\r') {
      assert.fail(`${label} must be a single command; found a line break in ${JSON.stringify(command)}`)
    }
    if (/\s/.test(character)) {
      if (word !== null) {
        words.push(word)
        word = null
      }
      index += 1
      continue
    }
    if (character === '"' || character === "'") {
      const end = text.indexOf(character, index + 1)
      assert.ok(end > index, `${label} has an unterminated ${character === '"' ? 'double' : 'single'} quote`)
      word = (word ?? '') + text.slice(index + 1, end)
      index = end + 1
      continue
    }
    assert.ok(!SHELL_CONTROL_CHARACTERS.has(character),
      `${label} must be a single plain command; found ${JSON.stringify(character)} in ${JSON.stringify(command)}`)
    word = (word ?? '') + character
    index += 1
  }
  if (word !== null) words.push(word)
  return words
}

function startsFeatureSuite(tokens) {
  return tokens.length >= FEATURE_SUITE_TOKENS.length && FEATURE_SUITE_TOKENS.every((token, index) => tokens[index] === token)
}

function isExactCiFeatureSuiteCommand(tokens) {
  return tokens.length === CI_FEATURE_SUITE_TOKENS.length && CI_FEATURE_SUITE_TOKENS.every((token, index) => tokens[index] === token)
}

function acceptsCiFeatureSuiteCommand(command) {
  try {
    return isExactCiFeatureSuiteCommand(shellWords(command, 'generated command'))
  } catch {
    return false
  }
}

// Negative control for the token comparison: across arbitrary generated
// commands, including near misses that a loose substring check would accept,
// acceptance agrees only with exact equality to the required command.
const CI_FEATURE_SUITE_COMMAND = CI_FEATURE_SUITE_TOKENS.join(' ')
const generatedTokens = fc.array(
  fc.constantFrom('npm', 'run', 'test:features', '--', '--parallel', '1', '2', '20', '--parallel=2', 'test', 'echo'),
  { maxLength: 8 },
)
const rejectedCommands = [
  'npm run test:features',
  'npm run test:features -- --parallel',
  'npm run test:features -- --parallel 20',
  'npm run test:features -- --parallel=2',
  'npm run test:features -- --parallel 2 --tags @component:repo-infrastructure',
  'echo npm run test:features -- --parallel 2',
  'npm run test:features -- --parallel 2 && npm run test:unit',
  'npm run test:features -- --parallel 2; npm run test:unit',
  'npm run test:features -- --parallel 2\nnpm run test:unit',
  'npm run test:features -- --parallel $PARALLEL_WORKERS',
  'npm run test:features -- --parallel 2 > /tmp/report.txt',
]

function assertExactTokenComparison() {
  fc.assert(fc.property(generatedTokens, tokens => {
    const command = tokens.join(' ')
    assert.equal(acceptsCiFeatureSuiteCommand(command), command === CI_FEATURE_SUITE_COMMAND,
      `Unexpected acceptance decision for ${JSON.stringify(command)}`)
  }), {
    seed: 104729,
    numRuns: 50,
    endOnFailure: true,
    examples: [
      [[]],
      [['npm']],
      [['npm', 'run', 'test:features']],
      [CI_FEATURE_SUITE_TOKENS],
    ],
  })
  assert.equal(acceptsCiFeatureSuiteCommand(CI_FEATURE_SUITE_COMMAND), true, 'The required CI feature-suite command must be accepted')
  for (const command of rejectedCommands) {
    assert.equal(acceptsCiFeatureSuiteCommand(command), false, `A non-exact CI feature-suite command was accepted: ${JSON.stringify(command)}`)
  }
}

Then('the CI feature-test step shall run exactly npm run test:features -- --parallel 2 unconditionally', function () {
  assertExactTokenComparison()

  const job = this.ci_workflow?.jobs?.test
  assert(job && Array.isArray(job.steps), 'CI test job and steps are required')

  // Locate the step by the feature-suite script it invokes, not by the
  // expected flag, so a step that runs the suite without the required
  // parallelism is still found and rejected.
  const candidates = job.steps.filter(step =>
    typeof step?.run === 'string' && /(?:^|\s)test:features(?:\s|$)/.test(step.run))
  assert.equal(candidates.length, 1,
    `Expected exactly one CI step to run the complete feature suite, found ${candidates.length}`)
  const [featureSuiteStep] = candidates

  assert.equal(featureSuiteStep.if, undefined,
    `The CI feature-test step must be unconditional, got if: ${JSON.stringify(featureSuiteStep.if)}`)
  assert.ok(!featureSuiteStep['continue-on-error'],
    'The CI feature-test step must not be allowed to fail')

  const tokens = shellWords(featureSuiteStep.run, 'CI feature-test step command')
  assert.ok(startsFeatureSuite(tokens),
    `The CI feature-test step must invoke npm run test:features directly, got ${JSON.stringify(featureSuiteStep.run)}`)
  assert.deepEqual(tokens, CI_FEATURE_SUITE_TOKENS,
    `The CI feature-test step must run exactly '${CI_FEATURE_SUITE_TOKENS.join(' ')}', got ${JSON.stringify(featureSuiteStep.run)}`)

  // Parallelism is confined to the CI invocation: the local default must stay
  // the unchanged, serial cucumber-js invocation.
  const manifest = JSON.parse(readFileSync(join(getRepoRoot(), 'package.json'), 'utf8'))
  assert.equal(manifest.scripts?.['test:features'], 'cucumber-js',
    "The local default 'npm run test:features' must remain the unchanged serial 'cucumber-js' invocation")
})
