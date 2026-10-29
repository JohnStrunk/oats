import { Plugin } from "@opencode/plugin/tui"

export default Plugin.define({
  id: "oats.tui",
  setup(context) {
    context.ui.toast.show({ message: "OATS loaded", variant: "success", duration: 3000 })
  },
})
