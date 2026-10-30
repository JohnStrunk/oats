import { When } from '@cucumber/cucumber'

When('the actual OATS TUI plugin is loaded by the sidebar host', async function () {
  const { default: plugin } = await import('../../../tui.js')
  this.sidebarDispose = await plugin.setup(this.sidebarHost.context)
})
