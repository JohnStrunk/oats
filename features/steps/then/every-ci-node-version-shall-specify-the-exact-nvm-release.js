import { Then } from '@cucumber/cucumber'
import { checkNodeVersions } from '../node_version_helper.js'

Then('every CI Node version shall specify the exact nvm release', function () {
  checkNodeVersions(this.nvmNodeVersion, this.ciNodeVersions)
})
