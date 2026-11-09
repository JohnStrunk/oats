import { Then } from '@cucumber/cucumber'
import { checkOpencodeClientPin } from '../manifest_helper.js'

Then('the manifest shall pin the OpenCode client to the exact version of the OpenCode plugin dependency', function () {
  checkOpencodeClientPin(this.repository_manifest)
})
