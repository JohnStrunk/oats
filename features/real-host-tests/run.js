import { fileURLToPath } from 'node:url'
import { REQUIRED_REAL_HOST_SUITES } from './required-suites.js'
import { runRequiredTestFile } from './required-test-runner.js'

let passed = true
for (const suite of REQUIRED_REAL_HOST_SUITES) {
  const file = fileURLToPath(new URL(`./${suite.file}`, import.meta.url))
  if (!await runRequiredTestFile(file, suite.name)) passed = false
}
if (!passed) process.exitCode = 1
