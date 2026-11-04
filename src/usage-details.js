import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { measureEditText } from '@opentui/core'
import { aggregateUsageDetails, renderPairTable } from './pricing-attribution.js'

let cachedModels = []

function updateClientModels(context) {
  try {
    const clientList = context?.client?.model?.list
    if (typeof clientList === 'function') {
      Promise.resolve(clientList()).then((res) => {
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null)
        if (Array.isArray(list)) cachedModels = list
      }).catch(() => {})
    }
  } catch {}
}

function getModels(context) {
  try {
    const locList = context?.data?.location?.model?.list
    if (typeof locList === 'function') {
      const res = locList()
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null)
      if (Array.isArray(list)) return list
    }
  } catch {}
  return cachedModels
}


let activeScroll = null

const MODAL_TITLE = 'Agent cost details'
const MODAL_CLOSE_LABEL = 'esc'

// The host backdrop skips its mouse-up dismissal while text is selected, so
// ending a drag-selection keeps the highlight instead of closing the modal.
function hasSelectedText(context) {
  return Boolean(context?.renderer?.getSelection?.()?.getSelectedText?.())
}

export function openUsageDetailsModal(context, sessionData, input) {
  if (!context?.ui?.dialog) return

  const releaseKeymap = context.keymap?.layer(() => ({
    mode: 'modal',
    priority: 1000,
    commands: [
      {
        bind: 'pagedown',
        title: 'Page down scroll',
        run() {
          activeScroll?.scrollBy(1 / 2, 'viewport')
        },
      },
      {
        bind: 'pageup',
        title: 'Page up scroll',
        run() {
          activeScroll?.scrollBy(-1 / 2, 'viewport')
        },
      },
      {
        bind: 'down,j',
        title: 'Scroll down',
        run() {
          activeScroll?.scrollBy(2, 'absolute')
        },
      },
      {
        bind: 'up,k',
        title: 'Scroll up',
        run() {
          activeScroll?.scrollBy(-2, 'absolute')
        },
      },
      {
        bind: 'escape',
        title: 'Close modal',
        run() {
          releaseKeymap?.()
          context.ui.dialog.clear()
        },
      },
    ],
  }))

  // The host backdrop skips its mouse-up dismissal while a text selection is
  // active, so the selection left by activating the details link would swallow
  // the first outside click. Opening the modal starts a fresh interaction.
  context.renderer?.clearSelection?.()
  updateClientModels(context)
  context.ui.dialog.show(() => {
    return createUsageDetailsModalView(context, sessionData, input)
  }, () => {
    releaseKeymap?.()
    activeScroll = null
  })
  try {
    context.ui.dialog.set?.({ size: 'large', centered: true })
  } catch {}
}

export function createUsageDetailsModalView(context, sessionData, input) {
  const [revision, setRevision] = createSignal(0, { equals: false })

  const unsubscribe = sessionData.subscribe(() => setRevision((v) => v + 1))
  onCleanup(unsubscribe)

  const outer = createElement('box')
  setProp(outer, 'width', '100%')
  setProp(outer, 'height', 30)
  setProp(outer, 'maxHeight', 30)
  setProp(outer, 'maxWidth', '100%')
  setProp(outer, 'flexDirection', 'column')
  // Fill the host dialog's panel width so the bordered surface spans every
  // panel cell; the wrapper handles the host's reserved row above it.
  setProp(outer, 'border', true)
  setProp(outer, 'borderStyle', 'single')
  setProp(outer, 'borderColor', context.theme?.text?.muted ?? context.theme?.text?.base)

  const header = createElement('box')
  setProp(header, 'flexDirection', 'row')
  setProp(header, 'justifyContent', 'space-between')
  setProp(header, 'width', '100%')
  setProp(header, 'flexShrink', 0)
  // Leave one cell before the right border so the esc label is not flush with
  // it, and is still a distinct clickable target.
  setProp(header, 'paddingRight', 1)

  const title = createElement('text')
  setProp(title, 'fg', context.theme?.text?.base)
  insert(title, MODAL_TITLE)
  insert(header, title)

  // Clearing the dialog runs the registered onClose cleanup, which also
  // releases the modal keymap layer. The esc label and the outside target
  // share this dismissal path.
  const dismissDialog = (event) => {
    context.ui?.dialog?.clear?.()
    event?.stopPropagation?.()
  }

  const closeButton = createElement('text')
  setProp(closeButton, 'fg', context.theme?.text?.muted ?? context.theme?.text?.base)
  setProp(closeButton, 'onMouseUp', (event) => {
    // The host's own close label dismisses on a plain left click regardless
    // of any selection.
    if (event.button === 0) dismissDialog(event)
  })
  insert(closeButton, MODAL_CLOSE_LABEL)
  insert(header, closeButton)
  insert(outer, header)

  // The scrollbox lays out its viewport and vertical scrollbar side by side, so
  // the box must hug the content for the scrollbar to sit beside the table
  // instead of at the far edge of the dialog.
  const detailsText = createMemo(() => {
    revision()
    const snapshot = sessionData.getSnapshot()
    const currentModels = getModels(context)
    const pairs = aggregateUsageDetails(snapshot?.records, currentModels)
    if (pairs.length === 0) {
      return 'No usage recorded'
    }
    return pairs.map(renderPairTable).join('\n\n')
  })
  // Measure with the host's own width method instead of estimating non-ASCII
  // code points conservatively, so narrow labels such as "é" do not leave a gap
  // between the widest rendered line and the scrollbar. The extra cell holds
  // the vertical scrollbar beside the content.
  const contentWidth = () => {
    const widthMethod = context.renderer.widthMethod
    return detailsText()
      .split('\n')
      .reduce((max, line) => Math.max(max, measureEditText(line, { widthMethod })), 1) + 1
  }
  // The body hugs the content so the scrollbox scrollbar stays beside the
  // table, while the bordered panel fills the host dialog width.
  const body = createElement('box')
  setProp(body, 'flexDirection', 'column')
  setProp(body, 'flexGrow', 1)
  setProp(body, 'alignSelf', 'flex-start')
  // Keep a long usage row inside the bordered panel in a narrower terminal.
  setProp(body, 'maxWidth', '100%')
  // Assigning a numeric width resets flex shrink, so restore the vertical
  // constraint after each width update. setProp applies a plain value
  // immediately and does not subscribe to signals: set the initial width
  // synchronously for the first frame, then update it from an effect as usage
  // records change.
  const fitBody = () => {
    setProp(body, 'width', contentWidth())
    setProp(body, 'flexShrink', 1)
    setProp(body, 'minHeight', 0)
  }
  fitBody()
  createEffect(fitBody)

  const scroll = createElement('scrollbox')
  setProp(scroll, 'flexGrow', 1)
  setProp(scroll, 'focused', true)
  activeScroll = scroll

  const textNode = createElement('text')
  setProp(textNode, 'fg', context.theme?.text?.base)
  insert(textNode, detailsText)
  insert(scroll, textNode)
  insert(body, scroll)
  insert(outer, body)

  // The host dialog panel reserves one row above its content. Cover that row
  // with an outside-click target so a click immediately above the bordered
  // panel takes the same dismissal path as the host backdrop.
  const outsideClick = createElement('box')
  setProp(outsideClick, 'width', '100%')
  setProp(outsideClick, 'height', 1)
  setProp(outsideClick, 'flexShrink', 0)
  setProp(outsideClick, 'onMouseUp', (event) => {
    if (event.button !== 0) return
    // Mirror the host backdrop: a mouse-up that ends a text drag-selection
    // must keep the selection instead of closing the modal.
    if (hasSelectedText(context)) return
    dismissDialog(event)
  })

  const panel = createElement('box')
  setProp(panel, 'width', '100%')
  setProp(panel, 'flexDirection', 'column')
  // Pull the wrapper into the host's reserved row without moving the bordered
  // panel, so the scrollbox keeps its original viewport and scrollbar.
  setProp(panel, 'marginTop', -1)
  insert(panel, outsideClick)
  insert(panel, outer)
  return panel
}
