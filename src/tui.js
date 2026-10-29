import { Plugin } from "@opencode/plugin/tui"
import { createSessionDataAccess } from "./session-data-access.js"

export default Plugin.define({
  id: "oats.tui",
  setup(context) {
    context.ui.toast.show({ message: "OATS loaded", variant: "success", duration: 3000 })
    const sessionData = createSessionDataAccess(context)
    return () => sessionData.dispose()
  },
})
