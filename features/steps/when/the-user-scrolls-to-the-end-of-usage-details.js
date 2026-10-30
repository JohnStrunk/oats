import { When } from '@cucumber/cucumber'
import { modal } from '../usage_details_helper.js'

When('the user scrolls to the end of usage details', async function () {
  await modal(this)
  for (let i = 0; i < 50; i++) this.sidebarPty.send('\x1b[6~')
})
