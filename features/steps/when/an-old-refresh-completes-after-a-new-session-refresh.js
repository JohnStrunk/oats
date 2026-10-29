import { When } from '@cucumber/cucumber'
When('an old refresh completes after a new session refresh', async function () {
  let entered, release
  const started = new Promise((resolve) => { entered = resolve })
  const promise = new Promise((resolve) => { release = resolve })
  this.host.gate = { entered, promise }
  const old = this.service.refresh()
  await started
  this.host.route = { type: 'session', sessionID: 'new-root' }
  await this.service.refresh()
  release()
  await old
})
