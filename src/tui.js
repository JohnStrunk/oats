import { Plugin } from "@opencode/plugin/tui"
import { createElement, insert, setProp } from '@opentui/solid'
import { createSessionDataAccess } from "./session-data-access.js"
import { createSignal } from 'solid-js'
import { createAgentStatsView } from './agent-stats.js'
import { createModelStatsView } from './model-stats.js'

export default Plugin.define({
  id: "oats.tui",
  setup(context) {
    context.ui.toast.show({ message: "OATS loaded", variant: "success", duration: 3000 })
    const sessionData = createSessionDataAccess(context)
    const [expanded, setExpanded] = createSignal(true)
    const toggleAgentStats = () => setExpanded((value) => !value)
    const [modelStatsExpanded, setModelStatsExpanded] = createSignal(true)
    const toggleModelStats = () => setModelStatsExpanded((value) => !value)
    const releaseSlot = context.ui.slot({
      append: 'sidebar.content',
      render: (input) => {
        const summaries = createElement('box')
        setProp(summaries, 'flexDirection', 'column')
        setProp(summaries, 'width', '100%')
        insert(summaries, createAgentStatsView(
          context,
          sessionData,
          input,
          expanded,
          toggleAgentStats,
        ))
        insert(summaries, createModelStatsView(
          context,
          sessionData,
          input,
          modelStatsExpanded,
          toggleModelStats,
        ))
        return summaries
      },
    })
    context.keymap?.layer(() => ({
      mode: 'global',
      commands: [{
        id: 'oats.agent-stats.toggle',
        title: 'Toggle Agent stats',
        group: 'OATS',
        bind: false,
        palette: true,
        run: toggleAgentStats,
      }, {
        id: 'oats.model-stats.toggle',
        title: 'Toggle Model stats',
        group: 'OATS',
        bind: false,
        palette: true,
        run: toggleModelStats,
      }],
    }))
    return () => { releaseSlot(); sessionData.dispose() }
  },
})
