import { When } from '@cucumber/cucumber'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
When('the reactive route switches from a loaded session to a session with blocked history', { timeout: 8000 }, async function () {
  const { stdout } = await run(process.execPath, ['--conditions=browser', 'features/steps/blocked_new_session_probe.js'], { timeout: 6000 })
  this.blockedRouteSnapshots = JSON.parse(stdout)
})
