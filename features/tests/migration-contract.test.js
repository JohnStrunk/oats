// Independent CLI-boundary checks for the test-runner migration.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { cleanupSandbox, populateSandbox, populateDiscoverySandbox, prepareNegativeFixture, sandboxEnvironment } from './migration-sandbox.js'
import { runProcess } from './migration-process.js'
import { assertCompleteInventory } from './migration-inventory.js'
import { requireFixtureScenario } from './migration-fixture-result.js'
import { readBoundedText, MAX_REPORT_BYTES, MAX_PROBE_BYTES } from './migration-output.js'
import { MIGRATION_RUN_TIMEOUT_MS, MIGRATION_STEP_TIMEOUT_MS } from './migration-time-budget.js'
import { PROCESS_MAX_CLEANUP_MS } from './migration-process.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const baseline = JSON.parse(readFileSync(join(root, 'features/tests/migration-baseline.json'), 'utf8'))

function temp(t) {
  const dir = mkdtempSync(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'oats-contract-'))
  t.after(() => cleanupSandbox(dir))
  return dir
}

async function runFeatures(dir, { cwd, args = [], sandbox = false, discoveryPrepared = false } = {}) {
  const report = join(dir, 'report.json')
  const log = join(dir, 'probe.log')
  if (!sandbox && !discoveryPrepared) await populateDiscoverySandbox(dir, root)
  const child = await runProcess('npm', ['run', 'test:features', '--', ...args, '--format', `json:${report}`], {
    cwd: cwd ?? dir, timeout: 120000,
    env: sandboxEnvironment(dir, { discovery: !sandbox, probeLog: sandbox ? log : undefined }),
  })
  assert.equal(child.timedOut, false, 'Feature runner timed out')
  assert.notEqual(child.status, null, 'Feature runner must exit')
  let data
  try {
    data = JSON.parse(readBoundedText(report, MAX_REPORT_BYTES))
  } catch (error) {
    assert.fail(`Feature runner did not produce JSON: ${error.message}\nexit=${child.status}\n${child.stdout}\n${child.stderr}`)
  }
  assert.ok(Array.isArray(data))
  return { child, data, probes: readBoundedText(log, MAX_PROBE_BYTES, { optional: true }).trim().split('\n').filter(Boolean) }
}

function scenarios(data) {
  return data.flatMap(feature => (feature.elements ?? []).filter(s => s.type === 'scenario')
    .map(s => ({ ...s, uri: feature.uri.replaceAll('\\', '/') })))
}

function assertResolved(step, description) {
  assert.ok(step.match?.location, `Undefined or ambiguous step ${description}: ${step.name}`)
  assert.ok(!['undefined', 'ambiguous'].includes(step.result?.status))
}

function assertBaseline(found, component) {
  for (const [uri, entries] of Object.entries(baseline)) {
    if (component && !uri.startsWith(`features/${component}/`)) continue
    for (const [line, name, ...exampleSteps] of entries) {
      const matches = found.filter(s => s.uri === uri && s.line === line)
      assert.equal(matches.length, 1, `Missing or duplicate ${uri}:${line}`)
      assert.equal(matches[0].name, name)
      const steps = matches[0].steps.filter(step => !step.hidden)
      assert.deepEqual(steps.slice(0, exampleSteps.length).map(step => step.name), exampleSteps)
      for (const step of steps) {
        assertResolved(step, `${uri}:${line}`)
      }
    }
  }
}

test('default discovery resolves all current and original identities', async t => {
  const { child, data } = await runFeatures(temp(t), { args: ['--dry-run'] })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  assertBaseline(scenarios(data))
  assertCompleteInventory(root, scenarios(data))
})

for (const component of ['plugin-ui', 'repo-infrastructure']) {
  test(`${component} discovery selects and resolves its current and original identities only`, async t => {
    const { child, data } = await runFeatures(temp(t), { args: ['--dry-run', '--tags', `@component:${component}`] })
    assert.equal(child.status, 0, child.stderr || child.stdout)
    const found = scenarios(data)
    assertBaseline(found, component)
    assertCompleteInventory(root, found, component)
    assert.ok(found.every(s => s.uri.startsWith(`features/${component}/`)))
  })
}

for (const component of [null, 'plugin-ui', 'repo-infrastructure']) {
  test(`default configuration executes ${component ?? 'both components'} in an isolated checkout`, async t => {
    const dir = temp(t)
    await populateSandbox(dir, root)
    const args = component ? ['--tags', `@component:${component}`] : []
    const { child, data, probes } = await runFeatures(dir, { cwd: dir, args, sandbox: true })
    assert.equal(child.status, 0, child.stderr || child.stdout)
    assert.deepEqual(probes.sort(), component ? [component] : ['plugin-ui', 'repo-infrastructure'])
    const found = scenarios(data)
    assert.equal(found.length, component ? 1 : 2)
    assert.ok(found.every(s => s.steps.filter(step => !step.hidden).every(step => step.result.status === 'passed')))
  })
}

for (const [tag, expected] of [['failure', 'failed'], ['undefined', 'undefined']]) {
  test(`${expected} fixture reports the failure and exits nonzero`, async t => {
    const dir = temp(t)
    await populateSandbox(dir, root)
    prepareNegativeFixture(dir)
    const { child, data, probes } = await runFeatures(dir, { cwd: dir, sandbox: true,
      args: ['--tags', `@contract-${tag}`] })
    const found = scenarios(data)
    requireFixtureScenario(found, tag)
    assert.equal(found[0].steps[0].result.status, expected)
    if (tag === 'failure') assert.match(found[0].steps[0].result.error_message, /AssertionError.*intentional assertion failure/s)
    assert.notEqual(child.status, 0)
    assert.deepEqual(probes, [])
  })
}

test('an unselected undefined scenario does not fail a component run', async t => {
  const dir = temp(t)
  await populateSandbox(dir, root)
  prepareNegativeFixture(dir)
  const { child, data, probes } = await runFeatures(dir, {
    cwd: dir, sandbox: true, args: ['--tags', '@component:plugin-ui'],
  })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  assert.deepEqual(probes, ['plugin-ui'])
  assert.deepEqual(scenarios(data).map(s => s.name), ['plugin-ui probe runs'])
})

test('ignored fixture filter is rejected by the fixture caller', async t => {
  const dir = temp(t)
  await populateSandbox(dir, root)
  prepareNegativeFixture(dir)
  // Omitting the filter simulates a runner that ignored it. Only sandbox
  // scenarios can run, and the same selector used by the caller rejects them.
  const { data, probes } = await runFeatures(dir, { cwd: dir, sandbox: true })
  assert.deepEqual(probes.sort(), ['plugin-ui', 'repo-infrastructure'])
  assert.throws(() => requireFixtureScenario(scenarios(data), 'failure'), /Fixture selection did not isolate/)
})

test('fixture caller rejects an actual empty runner selection', async t => {
  const dir = temp(t)
  await populateSandbox(dir, root)
  prepareNegativeFixture(dir)
  const { child, data } = await runFeatures(dir, { cwd: dir, sandbox: true, args: ['--tags', '@missing-contract'] })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  assert.deepEqual(scenarios(data), [])
  assert.throws(() => requireFixtureScenario(scenarios(data), 'failure'), /Fixture selection did not isolate/)
})

for (const kind of ['undefined', 'ambiguous']) {
  test(`dry-run ${kind} steps are rejected despite a zero exit`, async t => {
    const dir = temp(t)
    await populateSandbox(dir, root)
    prepareNegativeFixture(dir)
    if (kind === 'ambiguous') appendFileSync(join(dir, 'features/steps/given/contract-failure.js'),
      "\nGiven('an undefined fixture', function () {})\nGiven('an undefined fixture', function () {})\n")
    const { child, data } = await runFeatures(dir, { cwd: dir, sandbox: true,
      args: ['--tags', '@contract-undefined', '--dry-run'] })
    assert.equal(child.status, 0, child.stderr || child.stdout)
    const step = scenarios(data)[0].steps[0]
    assert.equal(step.result.status, kind)
    assert.throws(() => assertResolved(step, 'fixture'), /Undefined or ambiguous/)
  })
}

test('inventory rejects a duplicated example identity', async t => {
  const { child, data } = await runFeatures(temp(t), { args: ['--dry-run'] })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  const found = scenarios(data)
  const examples = found.filter(s => s.name === 'Invariant aggregate success across varying job combinations')
  assert.equal(examples.length, 3)
  examples[1].line = examples[0].line
  assert.throws(() => assertBaseline(found), /Missing or duplicate/)
})

test('inventory detects a newly added scenario omitted by the runner', async t => {
  const dir = temp(t)
  const { child, data } = await runFeatures(dir, { args: ['--dry-run'] })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  mkdirSync(join(dir, 'features/new-component'))
  writeFileSync(join(dir, 'features/new-component/new.feature'),
    '@component:new-component\nFeature: New behavior\n  Scenario: Newly added\n    Given a new input\n')
  assert.throws(() => assertCompleteInventory(dir, scenarios(data)), /omitted or added scenarios/)
})

test('a discovery runner ignoring dry-run fails before any step or host runs', async t => {
  const dir = temp(t)
  await populateDiscoverySandbox(dir, root)
  const marker = join(dir, 'executed')
  writeFileSync(join(dir, 'features/plugin-ui/canary.feature'),
    'Feature: Canary\n  Scenario: GUARD_CANARY\n    Given the discovery canary runs\n')
  writeFileSync(join(dir, 'features/steps/given/discovery-canary.js'),
    `import { Given } from '@cucumber/cucumber'; import { writeFileSync } from 'node:fs';\nGiven('the discovery canary runs', () => writeFileSync(${JSON.stringify(marker)}, 'executed'))\n`)
  // Omit --dry-run deliberately, exactly simulating a runner that ignored it.
  const child = await runProcess('npm', ['run', 'test:features', '--', '--name', '^GUARD_CANARY$'], {
    cwd: dir, timeout: 30000,
    env: sandboxEnvironment(dir, { discovery: true }),
  })
  assert.equal(child.timedOut, false)
  assert.notEqual(child.status, 0)
  assert.match(child.stdout + child.stderr, /Discovery child refused scenario execution/)
  assert.equal(existsSync(marker), false)
})

test('Cucumber step budget includes runner timeout and delayed cleanup', async t => {
  assert.ok(MIGRATION_STEP_TIMEOUT_MS > MIGRATION_RUN_TIMEOUT_MS + PROCESS_MAX_CLEANUP_MS)
  const dir = temp(t)
  await populateSandbox(dir, root)
  const marker = join(dir, 'cleaned')
  const childCode = `process.on('SIGTERM',()=>setTimeout(()=>{require('fs').writeFileSync(${JSON.stringify(marker)},'cleaned');process.exit(0)},500));setInterval(()=>{},1000)`
  writeFileSync(join(dir, 'features/plugin-ui/timeout-budget.feature'),
    '@timeout-budget\nFeature: Timeout cleanup\n  Scenario: Cleanup finishes before the step returns\n    When a timed-out child cleans up\n')
  const stepsDir = join(dir, 'features/steps/when')
  mkdirSync(stepsDir, { recursive: true })
  const processModule = pathToFileURL(join(root, 'features/tests/migration-process.js')).href
  const budgetModule = pathToFileURL(join(root, 'features/tests/migration-time-budget.js')).href
  writeFileSync(join(stepsDir, 'timeout-budget.js'), `import { When, setDefaultTimeout } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { runProcess } from ${JSON.stringify(processModule)}
import { MIGRATION_STEP_TIMEOUT_MS } from ${JSON.stringify(budgetModule)}
setDefaultTimeout(150)
When('a timed-out child cleans up', { timeout: MIGRATION_STEP_TIMEOUT_MS }, async function () {
  const result = await runProcess(process.execPath, ['-e', ${JSON.stringify(childCode)}], { cwd: ${JSON.stringify(dir)}, env: process.env, timeout: 1200, grace: 2000 })
  assert.equal(result.timedOut, true)
  assert.equal(existsSync(${JSON.stringify(marker)}), true, 'cleanup must finish before the step returns')
})\n`)
  const { child, data } = await runFeatures(dir, { cwd: dir, sandbox: true, args: ['--tags', '@timeout-budget'] })
  assert.equal(child.status, 0, child.stderr || child.stdout)
  assert.equal(existsSync(marker), true)
  assert.equal(scenarios(data)[0].steps[0].result.status, 'passed')
})

for (const mode of ['timeout', 'normal exit']) {
  test(`child process group is cleaned up on ${mode}`, async t => {
    const dir = temp(t)
    const ready = join(dir, 'ready')
    const late = join(dir, 'late')
    const grandchild = `require('fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(late)},'survived'),1800)`
    const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});${mode === 'timeout' ? 'setInterval(()=>{},1000)' : 'setTimeout(()=>process.exit(0),500)'}`
    const child = await runProcess(process.execPath, ['-e', parent], {
      cwd: dir, env: process.env, timeout: mode === 'timeout' ? 1000 : 5000, grace: 100,
    })
    assert.equal(child.timedOut, mode === 'timeout')
    assert.equal(existsSync(ready), true, 'Grandchild must start before cleanup')
    await new Promise(resolve => setTimeout(resolve, 2000))
    assert.equal(existsSync(late), false, 'Grandchild survived process-group cleanup')
  })
}

test('a successful target exit is not a timeout when a descendant inherits stdout', async t => {
  const dir = temp(t)
  const ready = join(dir, 'ready')
  const late = join(dir, 'late')
  const grandchild = `require('fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(late)},'survived'),1800)`
  const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'inherit'});setTimeout(()=>process.exit(0),500)`
  const child = await runProcess(process.execPath, ['-e', parent], {
    cwd: dir, env: process.env, timeout: 1200, grace: 100,
  })
  assert.equal(existsSync(ready), true, 'Grandchild must start before target exit')
  assert.equal(child.status, 0)
  assert.equal(child.timedOut, false)
  await new Promise(resolve => setTimeout(resolve, 2000))
  assert.equal(existsSync(late), false, 'Descendant holding stdout survived cleanup')
})

test('process output overflow fails after bounded capture and cleanup', async t => {
  const dir = temp(t)
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>process.stdout.write(Buffer.alloc(65536)),1)'], {
    cwd: dir, env: process.env, timeout: 5000, grace: 100, maxOutput: 1024,
  }), /Process output exceeded 1024 bytes/)
})

test('subprocess timeout and grace reject invalid durations before launch', async t => {
  const dir = temp(t)
  for (const timeout of [0, -1, NaN, Infinity, '1000', null]) {
    await assert.rejects(runProcess(process.execPath, ['-e', 'process.exit(0)'], { cwd: dir, timeout }), /timeout must be a finite/)
  }
  for (const grace of [-1, NaN, Infinity, '1000', null]) {
    await assert.rejects(runProcess(process.execPath, ['-e', 'process.exit(0)'], { cwd: dir, grace }), /grace must be a finite/)
  }
})

test('extreme finite durations are bounded before timers and supervisor requests', async t => {
  const dir = temp(t)
  const script = join(dir, 'control-supervisor.cjs')
  const observed = join(dir, 'observed')
  writeFileSync(script, `const net=require('net'),fs=require('fs');
net.createServer(s=>{s.setEncoding('utf8');s.write(JSON.stringify({type:'ready',protocol:2,pid:process.pid,token:'x'.repeat(64)})+'\\n');let b='';s.on('data',chunk=>{b+=chunk;let n;while((n=b.indexOf('\\n'))>=0){let x=JSON.parse(b.slice(0,n));b=b.slice(n+1);if(x.type==='start')s.write(JSON.stringify({type:'target-exit',exitCode:0,signal:null})+'\\n');if(x.type==='shutdown'){fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify(x));s.write(JSON.stringify({type:'clean'})+'\\n',()=>process.exit(0));}}})}).listen(process.argv[2]);\n`)
  const child = await runProcess(process.execPath, ['-e', 'process.exit(0)'], {
    cwd: dir, env: process.env, timeout: Number.MAX_SAFE_INTEGER,
    grace: Number.MAX_SAFE_INTEGER, supervisorPath: script,
  })
  assert.equal(child.status, 0)
  assert.equal(child.timedOut, false)
  assert.equal(JSON.parse(readFileSync(observed, 'utf8')).graceMs, 5000)
})

test('timed-out control setup never connects to a late supervisor', async t => {
  const dir = temp(t)
  const script = join(dir, 'late-supervisor.cjs')
  const listening = join(dir, 'listening')
  const launched = join(dir, 'launched')
  writeFileSync(script, `const net=require('net'),fs=require('fs');
setTimeout(()=>net.createServer(()=>fs.writeFileSync(${JSON.stringify(launched)},'launched')).listen(process.argv[2],()=>fs.writeFileSync(${JSON.stringify(listening)},'listening')),350);
setTimeout(()=>process.exit(0),800);\n`)
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.exit(0)'], {
    cwd: dir, env: process.env, timeout: 100, supervisorPath: script,
  }), /timed out before supervisor control was established/)
  assert.equal(existsSync(listening), true, 'The late supervisor must actually become available')
  assert.equal(existsSync(launched), false, 'The timed-out connector must never launch a target')
})

test('control setup fails promptly when the supervisor exits', async t => {
  const dir = temp(t)
  const script = join(dir, 'exited-supervisor.cjs')
  writeFileSync(script, 'setTimeout(()=>process.exit(12),50)\n')
  const started = Date.now()
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.exit(0)'], {
    cwd: dir, env: process.env, timeout: 5000, supervisorPath: script,
  }), /supervisor exited before control was established/)
  assert.ok(Date.now() - started < 3000, 'A dead supervisor must not consume the full deadline')
})

test('supervisor rejects a malformed start promptly without launching the target', async t => {
  const dir = temp(t)
  const marker = join(dir, 'target-launched')
  const started = Date.now()
  await assert.rejects(runProcess(process.execPath,
    ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'launched')`],
    { cwd: dir, env: process.env, timeout: 30000, testStartDeadlineNs: 'not-a-deadline' }),
  /Process supervisor rejected request: invalid start deadline/)
  assert.ok(Date.now() - started < 5000, 'A rejected start must not wait for the runner deadline')
  assert.equal(existsSync(marker), false)
})

test('supervisor rejects an expired start as a timeout without launching the target', async t => {
  const dir = temp(t)
  const marker = join(dir, 'target-launched')
  const started = Date.now()
  const child = await runProcess(process.execPath,
    ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'launched')`],
    { cwd: dir, env: process.env, timeout: 30000, testStartDeadlineNs: '0' })
  assert.equal(child.timedOut, true)
  assert.equal(child.status, null)
  assert.ok(Date.now() - started < 5000, 'An expired start must not wait for the runner deadline')
  assert.equal(existsSync(marker), false)
})

test('child-produced report and probe files are bounded by bytes', async t => {
  const dir = temp(t)
  const report = join(dir, 'report.json')
  const probe = join(dir, 'probe.log')
  const script = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(report)},'x'.repeat(129));fs.writeFileSync(${JSON.stringify(probe)},'y'.repeat(65))`
  const child = await runProcess(process.execPath, ['-e', script], { cwd: dir, env: process.env, timeout: 5000 })
  assert.equal(child.status, 0)
  assert.throws(() => readBoundedText(report, 128), /File exceeds 128 bytes/)
  assert.throws(() => readBoundedText(probe, 64), /File exceeds 64 bytes/)
  assert.equal(readBoundedText(report, 129).length, 129)
  assert.equal(readBoundedText(probe, 65).length, 65)
  const link = join(dir, 'link')
  symlinkSync(report, link)
  assert.throws(() => readBoundedText(link, 256), /ELOOP/)
})

test('production report and probe byte ceilings reject child-created oversized files', async t => {
  const dir = temp(t)
  const report = join(dir, 'report.json')
  const probe = join(dir, 'probe.log')
  const script = `const fs=require('node:fs');for(const [f,n] of ${JSON.stringify([[report, MAX_REPORT_BYTES + 1], [probe, MAX_PROBE_BYTES + 1]])}){fs.writeFileSync(f,'');fs.truncateSync(f,n)}`
  const child = await runProcess(process.execPath, ['-e', script], { cwd: dir, env: process.env, timeout: 5000 })
  assert.equal(child.status, 0)
  assert.throws(() => readBoundedText(report, MAX_REPORT_BYTES), /File exceeds 8388608 bytes/)
  assert.throws(() => readBoundedText(probe, MAX_PROBE_BYTES), /File exceeds 65536 bytes/)
})

test('an oversized child probe log fails the CLI contract', async t => {
  const dir = temp(t)
  await populateSandbox(dir, root)
  writeFileSync(join(dir, 'features/steps/given/sandbox-probe.js'), `import { Given } from '@cucumber/cucumber'
import { appendFileSync } from 'node:fs'
Given('the {string} sandbox probe records execution', function (component) {
  appendFileSync(process.env.OATS_SANDBOX_PROBE_LOG, 'x'.repeat(${MAX_PROBE_BYTES + 1}))
})\n`)
  await assert.rejects(runFeatures(dir, { cwd: dir, sandbox: true, args: ['--tags', '@component:plugin-ui'] }),
    /File exceeds 65536 bytes/)
})

for (const discovery of [false, true]) {
  test(`${discovery ? 'discovery' : 'fixture'} sandbox isolates HOME and XDG and blocks the host`, t => {
    const dir = temp(t)
    const env = sandboxEnvironment(dir, { discovery })
    for (const key of ['HOME', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'XDG_RUNTIME_DIR']) {
      assert.ok(env[key].startsWith(`${dir}/`), `${key} must stay in the sandbox`)
      assert.ok(existsSync(env[key]))
    }
    assert.equal(env.OATS_OPENCODE, join(dir, 'blocked-host'))
    assert.equal(existsSync(env.OATS_OPENCODE), false)
    assert.equal(env.NODE_OPTIONS, undefined)
  })
}

test('SIGKILL of the supervisor cannot masquerade as confirmed cleanup', async t => {
  const dir = temp(t)
  const ready = join(dir, 'ready')
  const alive = join(dir, 'alive-after-supervisor-killed')
  // The child supplies its supervisor's PID to a same-group grandchild.
  // That grandchild kills only the known live supervisor, demonstrates its
  // own survival, and exits promptly without leaving a persistent process.
  const killer = `process.on('SIGTERM',()=>{});require('fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>process.kill(Number(process.argv[1]),'SIGKILL'),600);setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(alive)},'alive'),900);setTimeout(()=>process.exit(0),1200)`
  const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(killer)},String(process.ppid)],{stdio:'ignore'});setTimeout(()=>process.exit(0),300)`
  await assert.rejects(runProcess(process.execPath, ['-e', parent], {
    cwd: dir, env: process.env, timeout: 5000, grace: 4000,
  }), /Process supervisor did not confirm descendant cleanup/)
  assert.equal(existsSync(ready), true)
  await new Promise(resolve => setTimeout(resolve, 1500))
  assert.equal(existsSync(alive), true, 'The regression must demonstrate an unclean surviving descendant')
})

test('unconfirmed escalation fails closed even when descendants are killed', async t => {
  const dir = temp(t)
  const ready = join(dir, 'ready')
  const late = join(dir, 'late')
  const grandchild = `process.on('SIGTERM',()=>{});require('fs').writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(late)},'survived'),1800)`
  const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setTimeout(()=>process.exit(0),500)`
  await assert.rejects(runProcess(process.execPath, ['-e', parent], {
    cwd: dir, env: process.env, timeout: 5000, grace: 100,
  }), /Process supervisor did not confirm descendant cleanup/)
  assert.equal(existsSync(ready), true)
  await new Promise(resolve => setTimeout(resolve, 2000))
  assert.equal(existsSync(late), false)
})

test('repository support refuses to load in a sandbox child', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./features/tests/migration-step-support.js')"], {
    cwd: root, encoding: 'utf8', env: { ...process.env, OATS_MIGRATION_SANDBOX_CHILD: '1' }, timeout: 10000,
  })
  assert.notEqual(child.status, 0)
  assert.match(child.stderr, /Sandbox child attempted to load repository migration steps/)
})

test('CI test job invokes the public feature runner', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
  const job = workflow.match(/^  test:\s*\n([\s\S]*?)(?=^  [\w-]+:\s*(?:\n|$)|(?![\s\S]))/m)?.[1]
  assert.ok(job, 'CI must define the test job')
  assert.match(job, /^\s*(?:run:\s*)?npm\s+run\s+test:features(?:\s|$)/m)
})
