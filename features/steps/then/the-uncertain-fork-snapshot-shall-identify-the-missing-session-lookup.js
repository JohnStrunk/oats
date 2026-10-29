import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the uncertain fork snapshot shall identify the missing session lookup', function () {
  const snapshot = this.uncertainForkSnapshot
  assert.equal(snapshot.sessionID, 'fork')
  assert.equal(snapshot.complete, false)
  assert.ok([...snapshot.errors, ...snapshot.gaps].some((entry) => entry.sessionID === 'fork' && (entry.operation === 'session.get' || /provenance|session.*(unavailable|missing|unknown)|lookup/.test(entry.kind ?? ''))), 'the unavailable session metadata must have an explicit gap or error')
})
