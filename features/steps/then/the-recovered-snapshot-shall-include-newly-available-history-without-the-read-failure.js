import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the recovered snapshot shall include newly available history without the read failure', function () {
  assert.equal(this.finished, true, 'faulted refresh did not finish before the watchdog')
  assert.equal(this.recoveredFinished, true, 'recovery refresh did not finish before the watchdog')
  assert.ok(this.incomplete.errors.some((error) => ['message.list', 'session.list', 'session.log'].includes(error.operation) && error.sessionID === 'root'), 'no read failure was observed before recovery')
  assert.ok(!this.recovered.errors.some((error) => ['message.list', 'session.list', 'session.log'].includes(error.operation) && error.sessionID === 'root'), 'read failure persisted after recovery')
  const fresh = this.recovered.records.filter((record) => record.messageID === 'new-after-recovery')
  assert.equal(fresh.length, 1)
  assert.equal(fresh[0].cost, 42)
  if (this.readFault.includes('child')) {
    assert.ok(this.recovered.records.some((record) => record.sessionID === 'new-child' && record.messageID === 'new-child-message' && record.cost === 42), 'new descendant history was not recovered')
  }
  if (this.readFault.includes('log')) {
    assert.ok(this.recovered.records.some((record) => record.eventID === 'recovered-usage' && record.cost === 17), 'new log usage was not recovered')
  }
})
