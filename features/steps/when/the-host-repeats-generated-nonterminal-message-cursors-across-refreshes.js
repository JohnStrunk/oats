import { When } from '@cucumber/cucumber'
import fc from 'fast-check'
import { boundedHost, boundedRefresh } from '../bounded_session_reads_helper.js'

When('the host repeats generated nonterminal message cursors across refreshes', async function () {
  this.generatedReads = []
  const cursors = fc.sample(fc.string({ minLength: 1, maxLength: 32 }), { seed: 804, numRuns: 8 })
  for (const cursor of cursors) {
    const host = await boundedHost()
    try {
      host.setRepeatedCursor(cursor)
      host.setFault('repeated message page')
      const finished = await boundedRefresh(host.service)
      this.generatedReads.push({ cursor, finished, before: host.baseline, after: structuredClone(host.service.getSnapshot()) })
    } finally {
      host.stop()
      host.service.dispose()
    }
  }
})
