import { createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { aggregateReportedCostsForDisplay, formatReportedCost } from './usage-aggregation.js'

export const formatCost = formatReportedCost

// shortcut: the pinned host's sidebar content is 30 columns; revisit if the
// host layout or sidebar width becomes configurable.
const HOST_CONTENT_WIDTH = 30
const MAX_LABEL_WIDTH = 16
const FULL_INCOMPLETE_MARKER = ' (incomplete)'
const COMPACT_INCOMPLETE_MARKER = ' (!)'
const INCOMPLETE_MARKER_LEGEND = '! = incomplete total'
const TRUNCATION_MARKER = '…'
// The pinned host renders the horizontal ellipsis in one cell, and it is also
// the marker appended by safeName below.
const TRUNCATION_MARKER_WIDTH = 1
// safeName replaces disallowed code points with U+FFFD, which the pinned host
// also renders in one cell.
const REPLACEMENT_CHARACTER = '�'

// Treat every other non-ASCII code point as two cells. Enumerating wide ranges
// by hand missed assigned ranges (for example Kana Supplement U+1B000), and a
// single missed wide code point can clip the amount or status marker. Assuming
// two cells is conservative: a narrow non-ASCII name is truncated a little
// sooner, but the row can never exceed the host width.
function charWidth(char) {
  if (char === TRUNCATION_MARKER) return TRUNCATION_MARKER_WIDTH
  if (char === REPLACEMENT_CHARACTER) return 1
  const code = char.codePointAt(0)
  return code >= 0x20 && code <= 0x7e ? 1 : 2
}

function textWidth(text) {
  let width = 0
  for (const char of text) width += charWidth(char)
  return width
}

// Agent names originate in session history. Keep control characters from
// changing the terminal layout or injecting terminal escape sequences.
function safeName(name, maxWidth = MAX_LABEL_WIDTH) {
  // Reserve room on a typical sidebar row for the cost and incompleteness
  // marker. Iterate by code point, not UTF-16 code unit, and account for wide
  // characters. Truncation is only presentation: grouping uses the original.
  const clean = name.replace(
    /[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu,
    REPLACEMENT_CHARACTER,
  )
  let result = ''
  let width = 0
  const parts = []
  for (const char of clean) {
    const next = charWidth(char)
    if (width + next > maxWidth) {
      while (width + TRUNCATION_MARKER_WIDTH > maxWidth && parts.length) {
        const part = parts.pop()
        result = result.slice(0, -part.char.length)
        width -= part.width
      }
      return `${result}${TRUNCATION_MARKER}`
    }
    result += char
    width += next
    parts.push({ char, width: next })
  }
  return result
}

const displayAmount = (item) => item.roundedCost ??
  (item.overflowDirection === 'negative' ? '<-$9999.99' :
    item.overflowDirection === 'positive' ? '>$9999.99' : 'unavailable')

const amountTail = (item) => 2 + displayAmount(item).length

// A fixed-width label (the reserved unattributed bucket) cannot shrink, and an
// unavailable total leaves little room on the pinned 30-column host. When the
// full word does not fit, use `(!)` and add the legend so it stays
// unambiguous. Named rows with a known amount reserve the full marker in their
// own budget, truncating the label instead so the clearer word is preserved.
function incompleteMarker(label, item, fixedLabel = false) {
  if (!item.incomplete) return ''
  const fullFits = textWidth(label) + amountTail(item) +
    FULL_INCOMPLETE_MARKER.length <= HOST_CONTENT_WIDTH
  if (fixedLabel || item.knownCost === null) {
    return fullFits ? FULL_INCOMPLETE_MARKER : COMPACT_INCOMPLETE_MARKER
  }
  return FULL_INCOMPLETE_MARKER
}

// A row only needs room for its own amount and marker. Budgeting per agent
// keeps an unrelated expensive incomplete row from shortening every label.
function labelBudget(item) {
  const naturalLabel = safeName(item.agent, MAX_LABEL_WIDTH)
  const tail = amountTail(item) +
    (item.incomplete ? incompleteMarker(naturalLabel, item).length : 0)
  return Math.min(MAX_LABEL_WIDTH, Math.max(1, HOST_CONTENT_WIDTH - tail))
}

const compareAgents = (a, b) =>
  a.agent < b.agent ? -1 : a.agent > b.agent ? 1 : 0

function displayLabels(agents) {
  const entries = agents.map((item) => {
    const budget = labelBudget(item)
    return { agent: item.agent, budget, candidate: safeName(item.agent, budget) }
  })
  const counts = new Map()
  for (const { candidate } of entries) counts.set(candidate, (counts.get(candidate) ?? 0) + 1)
  // The bucket has a reserved label, even if it is not currently present.
  const reserved = new Set(['Unattributed'])
  for (const { candidate } of entries) {
    if (candidate !== 'Unattributed' && counts.get(candidate) === 1) reserved.add(candidate)
  }
  const labels = new Map()
  let number = 1
  // Stable ordering makes collision suffixes independent of record order.
  for (const { agent, budget, candidate } of entries.sort(compareAgents)) {
    if (candidate !== 'Unattributed' && counts.get(candidate) === 1) {
      labels.set(agent, candidate)
      continue
    }
    // shortcut: after 36^(budget-1) global collisions a suffix-only label can
    // exceed a tiny per-agent budget; the costLine guard then compacts the
    // marker to keep the row within the host width.
    let label
    do {
      const suffix = ` #${(number++).toString(36)}`
      label = budget > suffix.length
        ? `${safeName(agent, budget - suffix.length)}${suffix}`
        : `#${(number - 1).toString(36)}`
    } while (reserved.has(label))
    reserved.add(label)
    labels.set(agent, label)
  }
  return labels
}

const costLine = (label, item, fixedLabel = false) => {
  const amount = displayAmount(item)
  let marker = incompleteMarker(label, item, fixedLabel)
  // Defensive guard: the per-agent budget should already have reserved this
  // marker's width.
  if (marker && textWidth(label) + amountTail(item) + marker.length > HOST_CONTENT_WIDTH) {
    marker = COMPACT_INCOMPLETE_MARKER
  }
  return `${label}: ${amount}${marker}`
}

export function agentStatsLines(snapshot, sessionID) {
  if (snapshot.sessionID !== sessionID) return ['Loading session history…']
  const summary = aggregateReportedCostsForDisplay(snapshot)
  // Each row's label is budgeted against its own amount and marker, while
  // collision suffixes are assigned globally so labels stay unique.
  const labels = displayLabels(summary.agents)
  const lines = summary.agents.map((agent) => costLine(labels.get(agent.agent), agent))
  if (summary.unattributed) lines.push(costLine('Unattributed', summary.unattributed, true))
  if (lines.some((line) => line.endsWith(COMPACT_INCOMPLETE_MARKER))) {
    lines.push(INCOMPLETE_MARKER_LEGEND)
  }
  if (lines.length === 0) {
    const gaps = snapshot.gaps ?? []
    const withheld = gaps.some(gap =>
      !['historical-usage-unavailable', 'retry-history-unavailable'].includes(gap?.kind))
    if (snapshot.errors?.length || withheld || (snapshot.complete !== true && gaps.length === 0)) {
      lines.push('Session history unavailable')
    } else lines.push('No agent usage recorded')
  }
  if (summary.incomplete) lines.push('Summary incomplete')
  return lines
}

// The host invokes the slot renderer in its Solid rendering context. These
// calls are equivalent to the output of the OpenTUI Solid JSX compiler.
export function createAgentStatsView(context, sessionData, input, expanded, toggle) {
  const [revision, setRevision] = createSignal(0, { equals: false })
  const unsubscribe = sessionData.subscribe(() => setRevision((value) => value + 1))
  onCleanup(unsubscribe)

  const box = createElement('box')
  setProp(box, 'flexDirection', 'column')
  const header = createElement('text')
  setProp(header, 'fg', context.theme?.text?.base)
  setProp(header, 'onMouseDown', (event) => {
    if (event.button === 0) { toggle(); event.stopPropagation?.() }
  })
  insert(header, () => `${expanded() ? '▾' : '▸'} Agent stats`)
  insert(box, header)

  const content = createElement('text')
  setProp(content, 'fg', context.theme?.text?.muted ?? context.theme?.text?.base)
  insert(content, () => {
    revision()
    return expanded() ? agentStatsLines(sessionData.getSnapshot(), input.sessionID).join('\n') : ''
  })
  insert(box, content)
  return box
}
