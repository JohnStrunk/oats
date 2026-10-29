import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the known regression usage shall not disappear', function () {
  for (const snapshot of [this.beforeRegressionRefresh, this.regressionHost.service.getSnapshot()]) {
    const records = snapshot.records.filter((r) => r.messageID === 'retry')
    assert.ok(records.some((r) => r.cost === 3), 'known historical usage must remain represented')
    assert.ok(records.some((r) => r.cost === 7), 'new retry usage must remain represented')
  }
})
