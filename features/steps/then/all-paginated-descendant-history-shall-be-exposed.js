import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('all paginated descendant history shall be exposed', function () {
  const snapshot = this.service.getSnapshot()
  const expected = []
  for (const [sessionID, messages] of Object.entries(this.host.messages)) {
    if (!['root', 'child', 'child2', 'grandchild'].includes(sessionID)) continue
    for (const message of messages) expected.push(`${sessionID}/${message.id}`)
  }
  assert.deepEqual(snapshot.records.map((r) => `${r.sessionID}/${r.messageID}`).sort(), expected.sort())
  assert.ok(this.host.calls.some(([kind, sessionID, cursor]) => kind === 'message' && sessionID === 'root' && cursor !== undefined), 'message history must actually span pages in this fixture')
  assert.ok(this.host.calls.some(([kind, parentID, cursor]) => kind === 'session' && parentID === 'root' && cursor !== undefined), 'child listing must actually span pages in this fixture')
  assert.equal(snapshot.complete, false)
  assert.ok(snapshot.gaps?.some((g) => g.kind === 'historical-usage-unavailable'))
})
