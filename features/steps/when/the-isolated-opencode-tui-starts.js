import { When } from '@cucumber/cucumber'
import { runTui } from '../tui_smoke_helper.js'
When('the isolated OpenCode TUI starts', { timeout: 90000 }, async function () {
  this.tui_result = await runTui({ configureOats: this.configure_oats, hostileAncestor: this.hostile_ancestor ?? false })
})
