import { When } from '@cucumber/cucumber'
import fc from 'fast-check'
import { pause, traversalHost, waitFor } from '../refresh_coalescing_helper.js'

When('generated bursts of in-scope structure events arrive during a blocked load', async function () {
  this.burstResult = await fc.check(fc.asyncProperty(fc.integer({ min: 2, max: 50 }), async (count) => {
    const h = traversalHost()
    this.coalescingHosts.push(h)
    try {
      await h.start()
      h.addChild()
      for (let i = 0; i < count; i++) h.emit('session.created', { parentID: 'root', sessionID: `child-${i}` })
      await pause(30)
      const loadsWhileBlocked = h.reads.filter((r) => r.method === 'get' && r.id === 'root').length
      h.release()
      await waitFor(() => h.service.getSnapshot().records.some((r) => r.sessionID === 'child'), 'The descendant was not exposed after the burst')
      await pause(30)
      const loadsTotal = h.reads.filter((r) => r.method === 'get' && r.id === 'root').length
      this.burstObservations = { count, loadsWhileBlocked, loadsTotal }
      return loadsWhileBlocked <= 2 && loadsTotal <= 2
    } finally { h.service.dispose(); h.release() }
  }), { numRuns: 12, seed: 404, endOnFailure: true })
})
