import { createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { aggregateReportedCostsForDisplay, formatReportedCost } from './usage-aggregation.js'
import { openUsageDetailsModal } from './usage-details.js'

export const formatCost = formatReportedCost

// Keep labels bounded for a 30-column row even though the pinned host's
// sidebar is wider. Actual row alignment is delegated to the host's layout.
const LABEL_ROW_BUDGET = 30
const MAX_LABEL_WIDTH = 16
const INCOMPLETE_MARKER_LEGEND = 'e = incomplete total'
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

// A row only needs room for its own amount and marker. Budgeting per agent
// keeps an unrelated expensive incomplete row from shortening every label.
function labelBudget(item) {
  // Reserve ": ", the amount and the marker cell, even for complete totals.
  return Math.min(MAX_LABEL_WIDTH, Math.max(1, LABEL_ROW_BUDGET - displayAmount(item).length - 3))
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
    // Suffix-only labels preserve uniqueness when a suffix fills the budget.
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

function agentStatsContent(snapshot, sessionID) {
  if (snapshot.sessionID !== sessionID) return [{ text: 'Loading session history…' }]
  const summary = aggregateReportedCostsForDisplay(snapshot)
  // Each row's label is budgeted against its own amount and marker, while
  // collision suffixes are assigned globally so labels stay unique.
  const labels = displayLabels(summary.agents)
  const row = (label, item) => ({
    label,
    amount: displayAmount(item),
    // Unavailable is already an explicit indication of an unknown total.
    marker: item.knownCost !== null && item.incomplete ? 'e' : ' ',
  })
  const content = summary.agents.map((agent) => row(labels.get(agent.agent), agent))
  if (summary.unattributed) content.push(row('Unattributed', summary.unattributed))
  if (content.some((item) => item.marker === 'e')) {
    content.push({ text: INCOMPLETE_MARKER_LEGEND })
  }
  if (content.length === 0) {
    const gaps = snapshot.gaps ?? []
    const withheld = gaps.some(gap =>
      !['historical-usage-unavailable', 'retry-history-unavailable'].includes(gap?.kind))
    if (snapshot.errors?.length || withheld || (snapshot.complete !== true && gaps.length === 0)) {
      content.push({ text: 'Session history unavailable' })
    } else content.push({ text: 'No agent usage recorded' })
  }
  if (summary.incomplete) content.push({ text: 'Summary incomplete' })
  return content
}

// A compact textual representation remains available to callers that do not
// mount the view. The live view uses flex layout instead of this fixed budget.
export function agentStatsLines(snapshot, sessionID) {
  return agentStatsContent(snapshot, sessionID).map((item) => {
    if (item.text) return item.text
    const spaces = Math.max(1, LABEL_ROW_BUDGET - textWidth(item.label) - 1 - item.amount.length - 1)
    return `${item.label}:${' '.repeat(spaces)}${item.amount}${item.marker}`
  })
}

// The host invokes the slot renderer in its Solid rendering context. These
// calls are equivalent to the output of the OpenTUI Solid JSX compiler.
export function createAgentStatsView(context, sessionData, input, expanded, toggle) {
  const [revision, setRevision] = createSignal(0, { equals: false })
  const unsubscribe = sessionData.subscribe(() => setRevision((value) => value + 1))
  onCleanup(unsubscribe)

  const box = createElement('box')
  setProp(box, 'flexDirection', 'column')
  setProp(box, 'width', '100%')

  const header = createElement('box')
  setProp(header, 'flexDirection', 'row')
  setProp(header, 'onMouseDown', (event) => {
    if (event.button === 0) { toggle(); event.stopPropagation?.() }
  })

  const title = createElement('text')
  setProp(title, 'fg', context.theme?.text?.base)
  setProp(title, 'onMouseDown', (event) => {
    if (event.button === 0) { toggle(); event.stopPropagation?.() }
  })
  insert(title, () => `${expanded() ? '▼' : '▶'} Agent stats `)
  insert(header, title)

  const details = createElement('text')
  setProp(details, 'fg', context.theme?.text?.muted ?? context.theme?.text?.base)
  setProp(details, 'onMouseDown', (event) => {
    if (event.button === 0) {
      event.stopPropagation?.()
    }
  })
  setProp(details, 'onMouseUp', (event) => {
    if (event.button === 0) {
      openUsageDetailsModal(context, sessionData, input)
      event.stopPropagation?.()
    }
  })
  insert(details, '(details)')
  insert(header, details)
  insert(box, header)

  const content = createElement('box')
  setProp(content, 'flexDirection', 'column')
  setProp(content, 'width', '100%')
  const color = context.theme?.text?.muted ?? context.theme?.text?.base
  insert(content, () => {
    revision()
    if (!expanded()) return []
    return agentStatsContent(sessionData.getSnapshot(), input.sessionID).map((item) => {
      if (item.text) {
        const status = createElement('text')
        setProp(status, 'fg', color)
        insert(status, item.text)
        return status
      }
      const row = createElement('box')
      setProp(row, 'width', '100%')
      setProp(row, 'height', 1)
      setProp(row, 'flexDirection', 'row')
      const label = createElement('text')
      setProp(label, 'fg', color)
      setProp(label, 'flexGrow', 1)
      setProp(label, 'flexShrink', 1)
      setProp(label, 'minWidth', 0)
      setProp(label, 'wrapMode', 'none')
      insert(label, `${item.label}:`)
      const value = createElement('text')
      setProp(value, 'fg', color)
      setProp(value, 'width', item.amount.length + 1)
      setProp(value, 'flexShrink', 0)
      insert(value, `${item.amount}${item.marker}`)
      insert(row, label)
      insert(row, value)
      return row
    })
  })
  insert(box, content)
  return box
}
