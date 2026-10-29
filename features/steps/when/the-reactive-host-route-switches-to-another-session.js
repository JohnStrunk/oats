import { When } from '@cucumber/cucumber'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
When('the reactive host route switches to another session', { timeout: 8000 }, async function () {
  const { stdout } = await run(process.execPath, ['--conditions=browser', 'features/steps/session_route_probe.js', 'switch'], { timeout: 6000 })
  this.routeSnapshot = JSON.parse(stdout)
})
