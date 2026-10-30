import { When } from '@cucumber/cucumber'
import { modal, updateControl } from '../usage_details_helper.js'

When('the details session changes', async function () {
  await modal(this)
  await updateControl(this, fixture => { fixture.route = 'ses_oats_new_root' })
})
