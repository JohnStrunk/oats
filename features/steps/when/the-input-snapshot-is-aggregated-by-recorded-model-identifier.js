import { When } from '@cucumber/cucumber'
import { aggregateModels } from '../model_aggregation_helper.js'

When('the input snapshot is aggregated by recorded model identifier', async function () {
  this.modelCostSummary = await aggregateModels(this.aggregationInput)
})
