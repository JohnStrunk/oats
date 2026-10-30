import { When } from '@cucumber/cucumber'

When('the current session snapshot is aggregated', async function () {
  const { createUsageAggregation } = await import('../../../src/usage-aggregation.js')
  const service = this.service ?? this.regressionHost?.service
  // Reuse the facade so later reads prove it does not cache stale summaries.
  this.usageAggregation ??= createUsageAggregation(service)
  this.costSummary = await this.usageAggregation.getSummary()
})
