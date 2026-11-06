import { createMemo, createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { measureEditText, normalizeColorValue, TextAttributes } from '@opentui/core'
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

// Semantic theme-token chains for the modal's three styled elements
// (issue #64). The modal title resolves an amber warning tone, each pair
// title a green success tone, and the table headers a muted tone, each with
// one fallback token for themes that lack the primary one. No fixed palette:
// the first chain candidate that renders visibly and stays distinct from the
// other elements and from ordinary numeric data wins, so custom themes keep
// working.
const MODAL_TITLE_TOKENS = ['text.feedback.warning.base', 'hue.yellow.100']
const PAIR_TITLE_TOKENS = ['text.feedback.success.base', 'hue.green.100']
const TABLE_HEADER_TOKENS = ['text.muted', 'border.base']

// The host backdrop skips its mouse-up dismissal while text is selected, so
// ending a drag-selection keeps the highlight instead of closing the modal.
function hasSelectedText(context) {
  return Boolean(context?.renderer?.getSelection?.()?.getSelectedText?.())
}

function createText(text, attributes, fg, bg) {
  const node = createElement('text')
  if (fg !== undefined) setProp(node, 'fg', fg)
  if (bg !== undefined) setProp(node, 'bg', bg)
  if (attributes !== undefined) setProp(node, 'attributes', attributes)
  insert(node, text)
  return node
}

function resolvedColorChannels(color) {
  if (color == null) return undefined
  try {
    const channels = normalizeColorValue(color)?.rgba?.toInts?.()
    return Array.isArray(channels) && channels.length === 4 && channels.every(Number.isFinite)
      ? channels
      : undefined
  } catch {
    return undefined
  }
}

function hasVisibleColor(color) {
  const channels = resolvedColorChannels(color)
  return channels !== undefined && channels[3] > 0
}

function sameResolvedColor(left, right) {
  const leftChannels = resolvedColorChannels(left)
  const rightChannels = resolvedColorChannels(right)
  return leftChannels !== undefined && rightChannels !== undefined &&
    leftChannels.every((channel, index) => channel === rightChannels[index])
}

// The host theme exposes per-surface tokens through a `surface` accessor
// that can throw for unsupported surface names, so guard the call.
function dialogSurface(theme) {
  try {
    if (typeof theme?.surface === 'function') return theme.surface('dialog')
  } catch {}
  return undefined
}

function distinctHeadingStyle(theme, raisedPreference, bodyFg) {
  const surface = dialogSurface(theme)

  const surfaceRaised = surface?.background?.raised
  const rootRaised = theme?.background?.raised
  const dialogBackground = surface?.background?.base ?? rootRaised?.base
  const normalFg = bodyFg !== undefined ? bodyFg : surface?.text?.base ?? theme?.text?.base

  for (const name of raisedPreference) {
    const candidate = surfaceRaised?.[name] ?? rootRaised?.[name]
    if (hasVisibleColor(candidate) &&
      !sameResolvedColor(candidate, dialogBackground) &&
      !sameResolvedColor(candidate, normalFg)) {
      return { fg: normalFg, bg: candidate }
    }
  }

  for (const name of ['muted', 'faint']) {
    const candidate = surface?.text?.[name] ?? theme?.text?.[name]
    if (hasVisibleColor(candidate) && !sameResolvedColor(candidate, normalFg)) {
      return { fg: candidate, bg: undefined }
    }
  }

  return { fg: normalFg, bg: undefined }
}

// Resolve a dotted semantic theme-token path such as
// "text.feedback.warning.base" against the live theme object. Every hop is
// guarded because host themes are reactive objects that can throw when a
// theme does not define a path.
function themeTokenValue(theme, path) {
  let node = theme
  for (const part of path.split('.')) {
    if (node === undefined || node === null) return undefined
    try {
      node = node[part]
    } catch {
      return undefined
    }
  }
  return node ?? undefined
}

// Resolve the modal's three styled elements — the bold modal title, the bold
// per-pair table titles, and the normal-weight table headers — from their
// semantic token chains (issue #64). Elements resolve in priority order
// (title, pair titles, then table headers); each takes the first chain
// candidate that renders visibly, contrasts with the dialog surface and the
// body foreground, and does not equal a color already assigned to an earlier
// element. That keeps every element distinct from ordinary numeric data and
// pairwise distinct from the other two on any theme. An element whose whole
// chain fails (a degenerate theme) degrades to the raised-surface heuristic,
// which self-checks visibility and distinctness rather than rendering
// invisible text.
function resolveHeadingStyles(theme, bodyFg) {
  const surface = dialogSurface(theme)
  const dialogBackground = surface?.background?.base ?? theme?.background?.raised?.base
  const usedColors = []

  const chainForeground = (tokenPaths) => {
    const forbidden = [dialogBackground, bodyFg, ...usedColors]
    for (const path of tokenPaths) {
      const candidate = themeTokenValue(theme, path)
      if (!hasVisibleColor(candidate)) continue
      if (forbidden.some(color => sameResolvedColor(color, candidate))) continue
      usedColors.push(candidate)
      return candidate
    }
    return undefined
  }

  const titleFg = chainForeground(MODAL_TITLE_TOKENS)
  const pairFg = chainForeground(PAIR_TITLE_TOKENS)
  const headerFg = chainForeground(TABLE_HEADER_TOKENS)

  return {
    // The raised-surface fallbacks keep the pre-issue-64 preferences: the
    // title prefers max, while pair titles and table headers prefer high.
    modalTitle: titleFg !== undefined
      ? { fg: titleFg, bg: undefined, attributes: TextAttributes.BOLD }
      : { ...distinctHeadingStyle(theme, ['max', 'high'], bodyFg), attributes: TextAttributes.BOLD },
    pairTitle: pairFg !== undefined
      ? { fg: pairFg, bg: undefined, attributes: TextAttributes.BOLD }
      : { ...distinctHeadingStyle(theme, ['high', 'max'], bodyFg), attributes: TextAttributes.BOLD },
    tableHeader: headerFg !== undefined
      ? { fg: headerFg, bg: undefined, attributes: undefined }
      : { ...distinctHeadingStyle(theme, ['high', 'max'], bodyFg), attributes: undefined },
  }
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

function createTableHeader(layout, widthMethod, headingStyle) {
  const parts = [' '.repeat(layout.rowLabelWidth)]
  for (let index = 0; index < layout.columns.length; index++) {
    const column = layout.columns[index]
    parts.push(padRight(column.label, column.width, widthMethod))
    if (index < layout.columns.length - 1) parts.push(' '.repeat(TABLE_COLUMN_GAP))
  }
  return createText(parts, headingStyle.attributes, headingStyle.fg, headingStyle.bg)
}

function createTableRow(row, layout, widthMethod, bodyFg, headingStyle) {
  const rowBox = createElement('box')
  setProp(rowBox, 'flexDirection', 'row')
  setProp(rowBox, 'width', '100%')
  setProp(rowBox, 'flexShrink', 0)

  const labelCell = createElement('box')
  setProp(labelCell, 'width', layout.rowLabelWidth)
  setProp(labelCell, 'height', 1)
  setProp(labelCell, 'flexShrink', 0)
  if (headingStyle.bg !== undefined) {
    setProp(labelCell, 'backgroundColor', headingStyle.bg)
  }

  const label = createText(
    headingStyle.bg === undefined
      ? padRight(row.label, layout.rowLabelWidth, widthMethod)
      : row.label,
    headingStyle.attributes,
    headingStyle.fg,
    headingStyle.bg,
  )
  insert(labelCell, label)
  const values = []

  for (let index = 0; index < layout.columns.length; index++) {
    const column = layout.columns[index]
    const { numeric, marker } = splitIncompleteValue(row.values[column.key])
    values.push(`${padLeft(numeric, column.numericWidth, widthMethod)}${marker}`)
    if (index < layout.columns.length - 1) values.push(' '.repeat(TABLE_COLUMN_GAP))
  }
  const numericValues = createText(values.join(''), undefined, bodyFg)
  insert(rowBox, [labelCell, numericValues])
  return rowBox
}

function createPairContent(pair, widthMethod, panelWidth, headingRefs, bodyFg, pairStyle, tableHeaderStyle) {
  const identity = `${pair.agentDisplay} - ${pair.modelDisplay}`
  const appliedText = pairHeadingText(identity, pair.reportedCost, widthMethod, panelWidth)
  const heading = createText(appliedText, pairStyle.attributes, pairStyle.fg, pairStyle.bg)
  // Keep a stable reference so layout can refit this heading in place instead
  // of replacing scrollbox children from inside onSizeChange.
  headingRefs.push({ node: heading, identity, reportedCost: pair.reportedCost, appliedText })

  const layout = tableLayout(pair, widthMethod)
  return [
    heading,
    createTableHeader(layout, widthMethod, tableHeaderStyle),
    ...layout.rows.map((row) => createTableRow(row, layout, widthMethod, bodyFg, tableHeaderStyle)),
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
  // The three styled elements each resolve their own colors and text
  // attributes: a bold title and bold pair titles from feedback/hue tokens,
  // and normal-weight table headers from muted tokens, pairwise distinct.
  const { modalTitle: titleStyle, pairTitle: pairStyle, tableHeader: tableHeaderStyle } = resolveHeadingStyles(context?.theme, bodyFg)
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

  const title = createText(MODAL_TITLE, titleStyle.attributes, titleStyle.fg, titleStyle.bg)

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
      content.push(...createPairContent(
        pair,
        widthMethod,
        measuredPanelWidth,
        headingRefs,
        bodyFg,
        pairStyle,
        tableHeaderStyle,
      ))
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
