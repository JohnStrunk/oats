import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the snapshot shall expose structured completeness information', function () {
  const snapshot = this.service.getSnapshot()
  assert.equal(typeof snapshot.complete, 'boolean')
  assert.ok(Array.isArray(snapshot.errors))
  assert.ok(Array.isArray(snapshot.gaps))
  for (const entry of [...snapshot.errors, ...snapshot.gaps]) {
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry))
  }
  for (const gap of snapshot.gaps) {
    assert.ok(typeof gap.kind === 'string' && gap.kind.length > 0)
  }
  if (snapshot.errors.length || snapshot.gaps.length) assert.equal(snapshot.complete, false)
})
