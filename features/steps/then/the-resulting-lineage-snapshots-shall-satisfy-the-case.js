import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the resulting lineage snapshots shall satisfy the {string} case', function (kind) {
  const record = (snapshot, id) => snapshot.records.filter((item) => item.sessionID === id && item.messageID === `${id}-message`)
  const listed = (listings, parent, ids) => listings.some((entry) => entry.parent === parent && !entry.failed && JSON.stringify(entry.ids.slice().sort()) === JSON.stringify(ids.slice().sort()))
  const failed = (snapshot, listings) => {
    assert.ok(listings.some((entry) => entry.parent === 'b' && entry.failed), 'b listing must actually fail')
    assert.ok(snapshot.errors.some((error) => error.operation === 'session.list' && error.sessionID === 'b'))
    assert.equal(snapshot.complete, false)
  }
  assert.equal(record(this.lineageBaseline, 'g').length, 1, 'baseline proves g under b')
  assert.ok(listed(this.lineageBaselineListings, 'root', ['a', 'b']))
  assert.ok(listed(this.lineageBaselineListings, 'a', []))
  assert.ok(listed(this.lineageBaselineListings, 'b', ['g']))
  assert.ok(listed(this.lineageMiddleListings, 'root', ['a', 'b']))
  assert.ok(listed(this.lineageMiddleListings, 'a', kind === 'authoritative moved lineage' ? ['g'] : []))
  failed(this.lineageMiddle, this.lineageMiddleListings)
  assert.deepEqual(record(this.lineageMiddle, 'g'), record(this.lineageBaseline, 'g'))
  assert.ok(listed(this.lineageFinalListings, 'root', ['b']))
  failed(this.lineageFinal, this.lineageFinalListings)
  assert.deepEqual(record(this.lineageFinal, 'b'), record(this.lineageBaseline, 'b'))
  assert.equal(record(this.lineageFinal, 'a').length, 0)
  if (kind === 'authoritative moved lineage') {
    assert.equal(record(this.lineageFinal, 'g').length, 0, 'the stale b link must not restore g after a is removed')
  } else {
    assert.deepEqual(record(this.lineageFinal, 'g'), record(this.lineageBaseline, 'g'), 'without exclusion, retain the known descendant')
  }
})
