import { createMemo, createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { measureEditText, TextAttributes } from '@opentui/core'
import { aggregateUsageDetails } from './pricing-attribution.js'

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
const TABLE_ROW_LABELS = ['Price', 'Tokens', 'Cost']
const TABLE_COLUMNS = [
  { key: 'input', label: 'input' },
  { key: 'output', label: 'output' },
  { key: 'cacheWrite', label: 'cache write' },
  { key: 'cacheRead', label: 'cache read' },
]
const TABLE_COLUMN_GAP = 1
const ELLIPSIS = '…'
// `features/steps/usage_details_screen.js` documents that the pinned host
// renders `size: 'large'` dialogs 88 columns wide. Use that as a conservative
// pre-measurement width so the first frame cannot lay out an unbounded heading.
const INITIAL_PANEL_WIDTH = 88

// The host backdrop skips its mouse-up dismissal while text is selected, so
// ending a drag-selection keeps the highlight instead of closing the modal.
function hasSelectedText(context) {
  return Boolean(context?.renderer?.getSelection?.()?.getSelectedText?.())
}

function createText(text, attributes, fg) {
  const node = createElement('text')
  if (fg !== undefined) setProp(node, 'fg', fg)
  if (attributes !== undefined) setProp(node, 'attributes', attributes)
  insert(node, text)
  return node
}

function measuredWidth(text, widthMethod) {
  return measureEditText(text, { widthMethod })
}

function padRight(text, width, widthMethod) {
  const padding = Math.max(0, width - measuredWidth(text, widthMethod))
  return `${text}${' '.repeat(padding)}`
}

function padLeft(text, width, widthMethod) {
  const padding = Math.max(0, width - measuredWidth(text, widthMethod))
  return `${' '.repeat(padding)}${text}`
}

function splitIncompleteValue(value) {
  const text = String(value ?? '—')
  const marked = text.endsWith('e')
  return {
    numeric: marked ? text.slice(0, -1) : text,
    marker: marked ? 'e' : ' ',
  }
}

// Truncate `text` to at most `maxWidth` terminal cells, ending with a one-cell
// ellipsis when anything was removed. Every prefix is measured with the host
// renderer's widthMethod so wide (two-cell) glyphs and combining marks keep the
// heading aligned on the real terminal grid.
function truncateToWidth(text, maxWidth, widthMethod) {
  if (maxWidth <= 0) return ''
  if (measuredWidth(text, widthMethod) <= maxWidth) return text

  const markerWidth = measuredWidth(ELLIPSIS, widthMethod)
  const budget = maxWidth - markerWidth
  if (budget <= 0) return ELLIPSIS

  let visible = ''
  let used = 0
  for (const char of text) {
    const charWidth = measuredWidth(char, widthMethod)
    if (used + charWidth > budget) break
    visible += char
    used += charWidth
  }
  return `${visible}${ELLIPSIS}`
}

// Build the single heading line for an agent/model pair. The content spans the
// padded panel interior, from three cells inside the left border to three cells
// inside the right border (the right inset also reserves the scrollbar column).
// The reported cost is always right-justified at that right edge; an overlong
// identity is ellipsized in terminal cells so it never wraps or displaces the
// cost. A panel width of zero means layout has not measured the modal yet, so
// fall back to the pinned host's large-dialog width until onSizeChange reports
// the real value.
function pairHeadingText(identity, reportedCost, widthMethod, panelWidth) {
  const measuredPanelWidth = Number.isFinite(panelWidth) && panelWidth > 0
    ? Math.floor(panelWidth)
    : INITIAL_PANEL_WIDTH
  const costWidth = measuredWidth(reportedCost, widthMethod)
  const headingWidth = Math.max(0, measuredPanelWidth - 6)
  const maxIdentityWidth = Math.max(0, headingWidth - costWidth - 2)
  const visibleIdentity = truncateToWidth(identity, maxIdentityWidth, widthMethod)
  const visibleIdentityWidth = measuredWidth(visibleIdentity, widthMethod)
  // Keep the existing two-cell separator. Flooring the remaining space keeps
  // string padding an integer and never lets it go negative.
  const headingGap = Math.max(2, Math.floor(headingWidth - visibleIdentityWidth - costWidth))
  return `${visibleIdentity}${' '.repeat(headingGap)}${reportedCost}`
}

function tableLayout(pair, widthMethod) {
  const rowLabelWidth = Math.max(
    ...TABLE_ROW_LABELS.map((label) => measuredWidth(label, widthMethod)),
  ) + 2
  const rows = TABLE_ROW_LABELS.map((label) => ({ label, values: pair[label.toLowerCase()] }))
  const columns = TABLE_COLUMNS.map(({ key, label }) => {
    const numericWidth = Math.max(
      ...rows.map(({ values }) => measuredWidth(splitIncompleteValue(values[key]).numeric, widthMethod)),
    )
    const width = Math.max(measuredWidth(label, widthMethod), numericWidth + 1)
    return { key, label, width, numericWidth: width - 1 }
  })

  return { rowLabelWidth, rows, columns }
}

function createTableHeader(layout, widthMethod, fg) {
  const text = createElement('text')
  if (fg !== undefined) setProp(text, 'fg', fg)
  setProp(text, 'attributes', TextAttributes.BOLD)
  const parts = [' '.repeat(layout.rowLabelWidth)]
  for (let index = 0; index < layout.columns.length; index++) {
    const column = layout.columns[index]
    parts.push(padRight(column.label, column.width, widthMethod))
    if (index < layout.columns.length - 1) parts.push(' '.repeat(TABLE_COLUMN_GAP))
  }
  insert(text, parts)
  return text
}

function createTableRow(row, layout, widthMethod, fg) {
  const rowBox = createElement('box')
  setProp(rowBox, 'flexDirection', 'row')
  setProp(rowBox, 'width', '100%')
  setProp(rowBox, 'flexShrink', 0)

  const label = createText(padRight(row.label, layout.rowLabelWidth, widthMethod), TextAttributes.BOLD, fg)
  const values = []

  for (let index = 0; index < layout.columns.length; index++) {
    const column = layout.columns[index]
    const { numeric, marker } = splitIncompleteValue(row.values[column.key])
    values.push(`${padLeft(numeric, column.numericWidth, widthMethod)}${marker}`)
    if (index < layout.columns.length - 1) values.push(' '.repeat(TABLE_COLUMN_GAP))
  }
  const numericValues = createText(values.join(''), undefined, fg)
  insert(rowBox, [label, numericValues])
  return rowBox
}

function createPairContent(pair, widthMethod, panelWidth, headingRefs, fg) {
  const identity = `${pair.agentDisplay} - ${pair.modelDisplay}`
  const appliedText = pairHeadingText(identity, pair.reportedCost, widthMethod, panelWidth)
  const heading = createText(appliedText, TextAttributes.BOLD, fg)
  // Keep a stable reference so layout can refit this heading in place instead
  // of replacing scrollbox children from inside onSizeChange.
  headingRefs.push({ node: heading, identity, reportedCost: pair.reportedCost, appliedText })

  const layout = tableLayout(pair, widthMethod)
  return [
    heading,
    createTableHeader(layout, widthMethod, fg),
    ...layout.rows.map((row) => createTableRow(row, layout, widthMethod, fg)),
  ]
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
  const widthMethod = context.renderer?.widthMethod
  const bodyFg = context.theme?.text?.base
  // Layout width is intentionally a plain variable, not a signal: changing it
  // must not invalidate the scrollbox's reactive children during onSizeChange.
  let measuredPanelWidth = 0
  const headingRefs = []

  const unsubscribe = sessionData.subscribe(() => setRevision((v) => v + 1))
  onCleanup(unsubscribe)

  const outer = createElement('box')
  setProp(outer, 'width', '100%')
  setProp(outer, 'height', 30)
  setProp(outer, 'maxHeight', 30)
  setProp(outer, 'maxWidth', '100%')
  setProp(outer, 'flexDirection', 'column')
  // Refit heading text nodes in place from the measured width. Replacing
  // scrollbox children here would race the host's layout pass (see the same
  // pattern and rationale in src/model-stats.js and src/agent-stats.js).
  const fitHeadings = () => {
    const measured = Math.floor(outer.width)
    if (!Number.isFinite(measured) || measured <= 0) return
    measuredPanelWidth = measured
    for (const ref of headingRefs) {
      const next = pairHeadingText(ref.identity, ref.reportedCost, widthMethod, measuredPanelWidth)
      if (ref.appliedText === next) continue
      ref.appliedText = next
      ref.node.content = next
    }
  }
  setProp(outer, 'onSizeChange', fitHeadings)
  setProp(outer, 'paddingTop', 1)
  setProp(outer, 'paddingBottom', 1)
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
  setProp(header, 'paddingLeft', 2)
  setProp(header, 'paddingRight', 2)

  const title = createElement('text')
  setProp(title, 'fg', context.theme?.text?.base)
  setProp(title, 'attributes', TextAttributes.BOLD)
  insert(title, MODAL_TITLE)

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
  insert(header, [title, closeButton])

  const detailsPairs = createMemo(() => {
    revision()
    const snapshot = sessionData.getSnapshot()
    const currentModels = getModels(context)
    return aggregateUsageDetails(snapshot?.records, currentModels)
  })

  const body = createElement('box')
  setProp(body, 'flexDirection', 'column')
  setProp(body, 'flexGrow', 1)
  setProp(body, 'width', '100%')
  setProp(body, 'maxWidth', '100%')
  setProp(body, 'flexShrink', 1)
  setProp(body, 'minHeight', 0)

  const scroll = createElement('scrollbox')
  setProp(scroll, 'flexGrow', 1)
  setProp(scroll, 'width', '100%')
  setProp(scroll, 'minHeight', 0)
  setProp(scroll, 'focused', true)
  // ScrollBox forwards its padding to the content renderable, leaving the
  // scrollbar at the scrollbox's right edge. The right padding is one cell
  // because the adjacent scrollbar itself occupies the other interior cell.
  setProp(scroll, 'paddingLeft', 2)
  setProp(scroll, 'paddingRight', 1)
  activeScroll = scroll

  const detailsContent = createMemo(() => {
    const pairs = detailsPairs()
    // This rebuild happens only for data changes, never for layout changes.
    headingRefs.length = 0
    if (pairs.length === 0) return [createText('No usage recorded', undefined, bodyFg)]

    const content = []
    for (const [index, pair] of pairs.entries()) {
      content.push(...createPairContent(pair, widthMethod, measuredPanelWidth, headingRefs, bodyFg))
      if (index < pairs.length - 1) content.push(createText(' ', undefined, bodyFg))
    }
    return content
  })
  insert(scroll, detailsContent)
  insert(body, scroll)
  insert(outer, [header, body])

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
