import { When } from '@cucumber/cucumber'
import { runTui } from '../tui_smoke_helper.js'
When('the OpenCode TUI explicitly loads the hostile plugin without OATS', { timeout: 90000 }, async function () {
  this.tui_result = await runTui({ configureOats: false, hostileAncestor: this.hostile_ancestor, loadHostileAsCli: true })
})
