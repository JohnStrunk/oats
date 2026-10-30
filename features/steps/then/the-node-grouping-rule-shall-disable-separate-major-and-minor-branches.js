import { Then } from '@cucumber/cucumber'
import { checkNodeGroupNoMajorMinorSplit } from '../node_grouping_helper.js'

Then('the Node grouping rule shall disable separate major and minor branches', function () {
  checkNodeGroupNoMajorMinorSplit(this.renovate_config)
})
