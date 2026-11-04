#!/usr/bin/env node
// On-demand local Cucumber profile. Runs the repository's unmodified
// `npm run test:features` command with an additional message formatter, then
// prints per-scenario and component timings derived from that message stream.
//
// Usage: node scripts/profile-features.js
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { constants as osConstants, tmpdir } from 'node:os'
import { join } from 'node:path'
import { aggregateScenarioTimings, formatProfileReport, parseCucumberMessages } from './profile-report.js'

const NPM_COMMAND = 'npm'
const MESSAGE_FILENAME = 'cucumber-messages.ndjson'
const CLEANUP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

// Tracked so an interrupted profiler does not leave the suite running.
let activeChild = null

function terminateActiveChild(signal) {
  if (activeChild && !activeChild.killed) activeChild.kill(signal)
}

function exitStatus({ code, signal }) {
  if (typeof code === 'number') return code
  const signalNumber = signal ? osConstants.signals[signal] : undefined
  return typeof signalNumber === 'number' ? 128 + signalNumber : 1
}

// Inherit stdio so npm's banner and the progress formatter stay visible while
// the full child-process wall time is measured around the run.
function runFeatureSuite(args) {
  return new Promise(resolve => {
    let settled = false
    const finish = result => {
      if (settled) return
      settled = true
      activeChild = null
      resolve(result)
    }
    let child
    try {
      child = spawn(NPM_COMMAND, args, { shell: false, stdio: 'inherit', env: process.env })
    } catch (error) {
      finish({ spawnError: error, code: null, signal: null })
      return
    }
    activeChild = child
    child.once('error', error => finish({ spawnError: error, code: null, signal: null }))
    child.once('close', (code, signal) => finish({ code, signal }))
  })
}

function installCleanup(cleanup) {
  const handlers = new Map()
  const onExit = () => {
    terminateActiveChild('SIGTERM')
    cleanup()
  }
  process.once('exit', onExit)
  for (const signal of CLEANUP_SIGNALS) {
    const handler = () => {
      terminateActiveChild(signal)
      cleanup()
      process.exit(128 + (osConstants.signals[signal] ?? 0))
    }
    handlers.set(signal, handler)
    process.once(signal, handler)
  }
  return () => {
    process.removeListener('exit', onExit)
    for (const [signal, handler] of handlers) process.removeListener(signal, handler)
  }
}

function missingReport(status, detail) {
  console.error(`profile-features: ${detail}`)
  return status === 0 ? 1 : status
}

async function run() {
  const tempRoot = existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir()
  const directory = mkdtempSync(join(tempRoot, 'oats-profile-'))
  const messagePath = join(directory, MESSAGE_FILENAME)
  const cleanup = () => rmSync(directory, { recursive: true, force: true })
  const removeHandlers = installCleanup(cleanup)

  try {
    const started = process.hrtime.bigint()
    const result = await runFeatureSuite(['run', 'test:features', '--', '--format', `message:${messagePath}`])
    const wallMilliseconds = Number(process.hrtime.bigint() - started) / 1e6
    if (result.spawnError) {
      console.error(`profile-features: could not start ${NPM_COMMAND}: ${result.spawnError.message}`)
      return 1
    }

    const status = exitStatus(result)
    let messageText
    try {
      messageText = readFileSync(messagePath, 'utf8')
    } catch {
      return missingReport(status,
        `npm run test:features produced no Cucumber message report (exit ${status}); no profile available`)
    }
    if (!messageText.trim()) {
      return missingReport(status,
        `npm run test:features produced an empty Cucumber message report (exit ${status}); no profile available`)
    }

    let envelopes
    let parseError
    try {
      envelopes = parseCucumberMessages(messageText, { strict: status === 0 })
    } catch (error) {
      // A failing suite may have stopped mid-message. Print the partial profile
      // instead of discarding it; a successful suite must be complete.
      parseError = error
      console.error(`profile-features: Cucumber message report is malformed: ${error.message}`)
      envelopes = parseCucumberMessages(messageText)
    }

    const { meta, scenarios } = aggregateScenarioTimings(envelopes)
    if (status === 0 && !meta) {
      console.error('profile-features: Cucumber message report has no meta envelope')
      return 1
    }

    console.log('')
    console.log(formatProfileReport({
      meta,
      scenarios,
      wallMilliseconds,
      exit: { code: result.code, signal: result.signal },
    }))
    return status === 0 && parseError ? 1 : status
  } finally {
    removeHandlers()
    cleanup()
  }
}

process.exitCode = await run()
