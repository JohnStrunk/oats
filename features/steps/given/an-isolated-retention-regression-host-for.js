import { Given } from '@cucumber/cucumber'
import { retentionHost } from '../retention_regression_helper.js'

Given('an isolated retention regression host for {string}', async function (kind) {
  if (!['node limit', 'stale grandchild', 'separate compactions'].includes(kind)) throw new Error(`Unknown fixture: ${kind}`)
  this.retentionHost = await retentionHost(kind)
})
