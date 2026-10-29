import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import * as ci from '../steps/workflow_helper.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = join(root, 'scripts/ci-lint.js')

function temporaryDirectory(t, { git = true } = {}) {
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-ci-discovery-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  if (git) {
    const init = spawnSync('git', ['init', '--quiet'], { cwd: dir, encoding: 'utf8' })
    assert.equal(init.status, 0, `git init failed: ${init.stderr}`)
  }
  return dir
}

function writeFixture(directory, path, contents) {
  const target = join(directory, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

function runCli(directory, kind, env = process.env) {
  const result = spawnSync(process.execPath, [cli, kind], { cwd: directory, encoding: 'utf8', timeout: 120000, env })
  assert.ifError(result.error)
  return result
}

// Availability comes from the runner's own tool resolution, so a tool installed
// only in node_modules (markdownlint) is not mistaken for a missing PATH tool.
const fixtures = [
  { kind: 'markdownlint', path: 'sample.md', clean: '# Heading\n\nText.\n', bad: '#Heading\n', diagnostic: /sample\.md:1:1 error MD018/ },
  { kind: 'yamllint', path: 'sample.yml', clean: 'key: value\n', bad: 'key: [\n', diagnostic: /syntax error/i },
  { kind: 'actionlint', path: '.github/workflows/sample.yml', clean: 'name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n', bad: 'name: Test\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - not-a-step-key: invalid\n', diagnostic: /not-a-step-key/i },
  { kind: 'shellcheck', path: 'scripts/sample.sh', clean: '#!/bin/sh\nprintf "%s\\n" "$1"\n', bad: '#!/bin/sh\nprintf "%s\\n" $1\n', diagnostic: /SC2086/ },
]

for (const fixture of fixtures) {
  test(`${fixture.kind} workflow command rejects an invalid file found by discovery`, { skip: !ci.linterAvailable(fixture.kind) && `missing ${fixture.kind}` }, t => {
    const dir = temporaryDirectory(t)
    writeFixture(dir, fixture.path, fixture.clean)
    const clean = runCli(dir, fixture.kind)
    assert.equal(clean.status, 0, `Clean discovered file: ${clean.stdout}\n${clean.stderr}`)
    writeFixture(dir, fixture.path, fixture.bad)
    const bad = runCli(dir, fixture.kind)
    assert.notEqual(bad.status, 0, 'An invalid discovered file must fail the workflow command')
    assert.match(`${bad.stdout}\n${bad.stderr}`, fixture.diagnostic, 'Failure must come from the linter, not an empty or broken discovery')
  })
}

test('an empty discovery fails instead of vacuously passing', t => {
  const dir = temporaryDirectory(t)
  writeFixture(dir, 'notes.txt', 'No lintable files here.\n')
  for (const { kind } of fixtures) {
    const result = runCli(dir, kind)
    assert.notEqual(result.status, 0, `${kind} must fail when discovery finds nothing`)
    assert.match(result.stderr, /No .* files discovered/, `${kind} must report the empty discovery`)
  }
})

test('a broken Git discovery fails instead of vacuously passing', t => {
  const dir = temporaryDirectory(t, { git: false })
  writeFixture(dir, 'sample.md', '#Heading\n')
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) }
  const result = runCli(dir, 'markdownlint', env)
  assert.notEqual(result.status, 0, 'A non-repository working directory must fail discovery')
  assert.match(result.stderr, /not a git repository/i, 'Failure must report the broken discovery')
})

test('markdown filenames that look like globs are linted literally', t => {
  const dir = temporaryDirectory(t)
  const names = ['!evil.md', '#hash.md', '-dash.md', 'foo[bar].md', 'star*.md', 'space name.md']
  for (const name of names) writeFixture(dir, name, '#Heading\n')
  const result = runCli(dir, 'markdownlint')
  assert.notEqual(result.status, 0, 'Glob-like filenames must not be excluded from linting')
  const output = `${result.stdout}\n${result.stderr}`
  for (const name of names) assert.ok(output.includes(`${name}:1:1 error MD018`), `${name} must be linted as a literal path:\n${output}`)
  for (const name of names) writeFixture(dir, name, '# Heading\n\nText.\n')
  const clean = runCli(dir, 'markdownlint')
  assert.equal(clean.status, 0, `Glob-like filenames must pass when clean: ${clean.stdout}\n${clean.stderr}`)
})
