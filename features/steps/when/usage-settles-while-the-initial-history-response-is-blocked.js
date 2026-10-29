import { When } from '@cucumber/cucumber'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
When('usage settles while the initial history response is blocked', { timeout: 8000 }, async function () {
  const { stdout } = await run(process.execPath, ['--conditions=browser', 'features/steps/session_route_probe.js', 'settlement'], { timeout: 6000 })
  this.routeSnapshot = JSON.parse(stdout)
})
