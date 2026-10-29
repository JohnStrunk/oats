import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { waitForSnapshot } from '../session_data_helper.js'
Then('the proven live fork record and descendant history shall remain visible', async function () {
  const snapshot = await waitForSnapshot(this.service, (s) => s.records.some((r) => r.messageID === 'fork-live'))
  assert.deepEqual(snapshot.records.map((r) => [r.sessionID, r.messageID, r.cost]).sort(), [['fork-child', 'child-own', 4], ['root', 'fork-live', 5]])
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'fork-provenance-uncertain' && g.sessionID === 'root'))
})
