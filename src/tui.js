import { Plugin } from "@opencode/plugin/tui"
import { createSessionDataAccess } from "./session-data-access.js"
import { createSignal } from 'solid-js'
import { createAgentStatsView } from './agent-stats.js'

export default Plugin.define({
  id: "oats.tui",
  setup(context) {
    context.ui.toast.show({ message: "OATS loaded", variant: "success", duration: 3000 })
    const sessionData = createSessionDataAccess(context)
    const [expanded, setExpanded] = createSignal(true)
    const toggle = () => setExpanded((value) => !value)
    const releaseSlot = context.ui.slot({
      append: 'sidebar.content',
      render: (input) => createAgentStatsView(context, sessionData, input, expanded, toggle),
    })
    context.keymap?.layer(() => ({
      mode: 'global',
      commands: [{
        id: 'oats.agent-stats.toggle',
        title: 'Toggle Agent stats',
        group: 'OATS',
        bind: false,
        palette: true,
        run: toggle,
      }],
    }))
    return () => { releaseSlot(); sessionData.dispose() }
  },
})
