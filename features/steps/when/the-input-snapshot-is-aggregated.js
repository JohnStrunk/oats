import { When } from '@cucumber/cucumber'
import { aggregate } from '../aggregation_helper.js'

When('the input snapshot is aggregated', async function () {
  this.costSummary = await aggregate(this.aggregationInput)
})
