import { runCiLinter } from '../features/steps/ci_linter.js'

const result = runCiLinter(process.argv[2], { cwd: process.cwd() })
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exitCode = result.status
