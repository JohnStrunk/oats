// Focused runner for the issue #6 real-host sidebar contract. The full
// `npm run test:real-host` gate includes this suite through required-suites.js;
// this file remains useful for a shorter, single-suite run.
import { fileURLToPath } from 'node:url'
import { SIDEBAR_SUITE } from './required-suites.js'
import { runRequiredTestFile } from './required-test-runner.js'

const file = fileURLToPath(new URL(`./${SIDEBAR_SUITE.file}`, import.meta.url))
if (!await runRequiredTestFile(file, SIDEBAR_SUITE.name)) process.exitCode = 1
