import { When } from '@cucumber/cucumber'
import { boundedRefresh } from '../bounded_session_reads_helper.js'
import { session } from '../regression_session_helper.js'

When('the host supplies an unbounded single-child chain with a small subtree limit', async function () {
  const h = this.treeContext.client.session
  let calls = 0
  h.list = async ({ parentID }) => {
    calls++
    // A fixture safety ceiling is not an acceptable system read limit.
    if (calls > 100) throw new Error('fixture safety ceiling reached')
    const child = parentID === 'root' ? 'child' : parentID === 'child' ? 'chain-1' : `chain-${Number(parentID.slice(6)) + 1}`
    return { data: [session(child, parentID)], cursor: {} }
  }
  this.chainFinished = await boundedRefresh(this.service)
  this.chainSnapshot = structuredClone(this.service.getSnapshot())
  this.chainCalls = calls
})
