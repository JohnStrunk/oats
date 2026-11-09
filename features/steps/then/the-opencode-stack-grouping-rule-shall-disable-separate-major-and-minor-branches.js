import { Then } from '@cucumber/cucumber'
import { checkStackGroupNoMajorMinorSplit } from '../opencode_stack_helper.js'

Then('the OpenCode stack grouping rule shall disable separate major and minor branches', function () {
  checkStackGroupNoMajorMinorSplit(this.renovate_config)
})
