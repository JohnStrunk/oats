import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import * as ci from '../steps/workflow_helper.js'

// Each control uses the same file and invocation before and after introducing
// the violation; the output must contain the real tool's diagnostic.
const fixtures = [
  { kind: 'markdownlint', path: 'sample.md', clean: '# Heading\n\nText.\n', bad: '#Heading\n', diagnostic: /MD018/ },
  { kind: 'yamllint', path: 'sample.yml', clean: 'key: value\n', bad: 'key: [\n', diagnostic: /syntax error/i },
  { kind: 'actionlint', path: '.github/workflows/sample.yml', clean: 'name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n', bad: 'name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - not-a-step-key: invalid\n', diagnostic: /not-a-step-key/i },
  { kind: 'shellcheck', path: 'sample.sh', clean: '#!/bin/sh\nprintf "%s\\n" "$1"\n', bad: '#!/bin/sh\nprintf "%s\\n" $1\n', diagnostic: /SC2086/ },
]

for (const fixture of fixtures) {
  test(`${fixture.kind} actually accepts clean input and rejects invalid input`, t => {
    const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-ci-lint-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    const path = join(dir, fixture.path)
    mkdirSync(dirname(path), { recursive: true })
    const run = () => ci.runCiLinter(fixture.kind, { cwd: dir, files: [fixture.path] })
    writeFileSync(path, fixture.clean)
    const clean = run()
    assert.equal(clean.status, 0, `Clean fixture: ${clean.stdout}\n${clean.stderr}`)
    writeFileSync(path, fixture.bad)
    const bad = run()
    assert(Number.isInteger(bad.status) && bad.status !== 0, 'Invalid fixture must fail')
    assert.match(`${bad.stdout}\n${bad.stderr}`, fixture.diagnostic, 'Failure must be a linter diagnostic, not a missing tool or unrelated error')
    writeFileSync(path, fixture.clean)
    const restored = run()
    assert.equal(restored.status, 0, `Restored fixture: ${restored.stdout}\n${restored.stderr}`)
  })
}

test('the workflow linter rejects runners and containers that would not use implicit Linux bash', () => {
  for (const runsOn of ['windows-latest', 'macos-15', 'self-hosted', '${{ matrix.os }}']) {
    const workflow = structuredClone(ci.loadCiWorkflow())
    workflow.jobs['lint-markdown']['runs-on'] = runsOn
    assert.throws(() => ci.runCiWorkflowLinter('markdownlint', workflow), /Ubuntu runner/, runsOn)
  }
  const container = structuredClone(ci.loadCiWorkflow())
  container.jobs['lint-shell'].container = { image: 'node:24' }
  assert.throws(() => ci.runCiWorkflowLinter('shellcheck', container), /job execution settings/)
  const workflowEnv = structuredClone(ci.loadCiWorkflow())
  workflowEnv.env = { BASH_ENV: '/tmp/injected.sh' }
  assert.throws(() => ci.runCiWorkflowLinter('shellcheck', workflowEnv), /workflow execution settings/)
})
