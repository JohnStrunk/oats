import { run } from 'node:test'

// node:test normally considers skipped and empty test runs successful. For an
// explicit host contract run, neither is evidence that the contract ran.
export async function runRequiredTestFile(file, requiredName, output = process.stdout) {
  let summary
  let requiredPassed = false
  for await (const event of run({ files: [file], concurrency: 1 })) {
    const { type, data } = event
    if (type === 'test:stdout' || type === 'test:stderr') output.write(data.message)
    if (type === 'test:pass') output.write(`${data.skip ? 'SKIP' : data.todo ? 'TODO' : 'PASS'} ${data.name}${data.skip ? `: ${data.skip}` : ''}\n`)
    if (type === 'test:pass' && data.name === requiredName && !data.skip && !data.todo) requiredPassed = true
    if (type === 'test:fail') output.write(`FAIL ${data.name}\n${data.details?.error?.stack ?? data.details?.error ?? ''}\n`)
    if (type === 'test:summary' && !data.file) summary = data
  }
  if (!requiredPassed || !summary || !summary.success || summary.counts.tests < 1 || summary.counts.passed < 1 ||
      summary.counts.failed || summary.counts.cancelled || summary.counts.skipped || summary.counts.todo) {
    output.write(`Required real-host tests did not all run successfully: ${JSON.stringify(summary?.counts ?? 'no summary')}\n`)
    return false
  }
  return true
}
