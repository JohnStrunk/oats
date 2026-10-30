import { createEffect, createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
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
  setProp(outer, 'width', '100%')
  setProp(outer, 'height', 30)
  setProp(outer, 'maxHeight', 30)

  const scroll = createElement('scrollbox')
  setProp(scroll, 'flexDirection', 'column')
  setProp(scroll, 'flexGrow', 1)
  setProp(scroll, 'focused', true)
  activeScroll = scroll

  const textNode = createElement('text')
  setProp(textNode, 'fg', context.theme?.text?.base)
  insert(textNode, () => {
    revision()
    const snapshot = sessionData.getSnapshot()
    const currentModels = getModels(context)
    const pairs = aggregateUsageDetails(snapshot?.records, currentModels)
    if (pairs.length === 0) {
      return 'No usage recorded'
    }
    return pairs.map(renderPairTable).join('\n\n')
  })
  insert(scroll, textNode)
  insert(outer, scroll)
  return outer
}
