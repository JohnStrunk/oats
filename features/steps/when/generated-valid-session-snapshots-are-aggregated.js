import { When } from '@cucumber/cucumber'
import { aggregate } from '../aggregation_helper.js'

When('generated valid session snapshots are aggregated', function () {
  this.aggregateGeneratedSnapshot = aggregate
})
