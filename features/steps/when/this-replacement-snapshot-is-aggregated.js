import { When } from '@cucumber/cucumber'
import { aggregate } from '../aggregation_helper.js'

When('this replacement snapshot is aggregated:', async function (snapshot) {
  this.costSummary = await aggregate(JSON.parse(snapshot))
})
