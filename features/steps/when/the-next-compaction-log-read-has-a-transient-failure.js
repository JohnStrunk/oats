import { When } from '@cucumber/cucumber'

When('the next compaction log read has a transient {string}', async function (failure) {
  const h = this.followupHost
  if (!['error', 'stall'].includes(failure)) throw new Error(`Unexpected failure: ${failure}`)
  const original = h.context.client.session.log
  let release
  const gate = new Promise((resolve) => { release = resolve })
  h.context.client.session.log = async function* () {
    if (failure === 'error') throw new Error('transient log failure')
    await gate
  }
  let timer
  try {
    await Promise.race([
      h.service.refresh(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('refresh exceeded the test watchdog')), 4000) }),
    ])
    this.failedCompactionSnapshot = structuredClone(h.service.getSnapshot())
  } finally {
    clearTimeout(timer)
    release()
    h.context.client.session.log = original
  }
})
