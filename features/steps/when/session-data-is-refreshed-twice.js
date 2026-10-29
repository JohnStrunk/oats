import { When } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
When('session data is refreshed twice', async function () {
  await this.service.refresh()
  const before = this.service.getSnapshot().records.map((r) => r.id).sort()
  await this.service.refresh()
  assert.deepEqual(this.service.getSnapshot().records.map((r) => r.id).sort(), before, 'record identity must be stable')
})
