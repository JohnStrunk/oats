import { fileURLToPath } from 'node:url'
import { runRequiredTestFile } from './required-test-runner.js'

const file = fileURLToPath(new URL('./session-data-access.real-host.test.js', import.meta.url))
if (!await runRequiredTestFile(file, 'session data access follows the pinned OpenCode session tree')) process.exitCode = 1
