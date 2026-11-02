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
  setProp(outer, 'height', 30)
  setProp(outer, 'maxHeight', 30)
  setProp(outer, 'maxWidth', '100%')

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
  // setProp applies a plain value immediately and does not subscribe to
  // signals. Set the initial width synchronously so the first frame is laid
  // out correctly, then update it from an effect as usage records change.
  setProp(outer, 'width', contentWidth())
  createEffect(() => setProp(outer, 'width', contentWidth()))

  const scroll = createElement('scrollbox')
  setProp(scroll, 'flexGrow', 1)
  setProp(scroll, 'focused', true)
  activeScroll = scroll

  const textNode = createElement('text')
  setProp(textNode, 'fg', context.theme?.text?.base)
  insert(textNode, detailsText)
  insert(scroll, textNode)
  insert(outer, scroll)
  return outer
}
