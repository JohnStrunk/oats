import { createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { aggregateReportedCostsForDisplay, formatReportedCost } from './usage-aggregation.js'
import { openUsageDetailsModal } from './usage-details.js'
import {
  REPLACEMENT_CHARACTER,
  TRUNCATION_MARKER,
  TRUNCATION_MARKER_WIDTH,
  charWidth,
  textWidth,
} from './display-width.js'

export const formatCost = formatReportedCost

// Keep the compact textual rows bounded even though the pinned host's sidebar
// is wider. Actual row alignment in the live view is delegated to the host's
// layout.
const LABEL_ROW_BUDGET = 30
// Name-width fallback used only before the first measured content-box layout.
// Its value is the smallest name allowance of the compact LABEL_ROW_BUDGET
// representation (that budget minus the widest amount, "unavailable", minus the
// separators), so an untrusted long name stays inside the row until the first
// layout pass supplies the measured width.
const INITIAL_NAME_WIDTH = 16
const INCOMPLETE_MARKER_LEGEND = 'e = estimated'

// The name gets whatever is left after the colon, one separator cell, the
// amount, and the always-reserved marker cell.
const nameWidth = (rowWidth, amountWidth) => Math.max(1, rowWidth - amountWidth - 3)

// Agent names originate in session history. Keep control characters from
// changing the terminal layout or injecting terminal escape sequences.
function sanitizeName(name) {
  return name.replace(
    /[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu,
    REPLACEMENT_CHARACTER,
  )
}

// Iterate by code point, not UTF-16 code unit, and account for wide
// characters. Truncation is only presentation: grouping uses the original.
function truncateName(clean, maxWidth) {
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

const compareAgents = (a, b) => {
  if (a.agent !== b.agent) return a.agent < b.agent ? -1 : 1
  // Identical agent strings can occur when the reserved Unattributed bucket
  // sits beside a recorded agent with that same name. Keep record order.
  return a.index - b.index
}

// Assign labels from the names fitted to each row's own available width. A
// name is only suffixed when its fitted form really collides with another
// fitted form, so wider rows keep distinct full names intact.
function displayLabels(rows, availableNameWidth) {
  const entries = rows.map((row, index) => {
    const available = availableNameWidth(row, index)
    return {
      index,
      agent: row.agent,
      clean: row.clean,
      available,
      reserved: row.reserved === true,
      candidate: truncateName(row.clean, available),
    }
  })
  const counts = new Map()
  for (const { candidate } of entries) counts.set(candidate, (counts.get(candidate) ?? 0) + 1)
  // The bucket has a reserved label, even if it is not currently present.
  const reserved = new Set(['Unattributed'])
  for (const { candidate } of entries) {
    if (candidate !== 'Unattributed' && counts.get(candidate) === 1) reserved.add(candidate)
  }
  const labels = new Array(rows.length)
  let number = 1
  // Stable ordering makes collision suffixes independent of record order.
  for (const { index, clean, available, candidate, reserved: isReserved } of entries.sort(compareAgents)) {
    if (isReserved) {
      labels[index] = 'Unattributed'
      continue
    }
    if (candidate !== 'Unattributed' && counts.get(candidate) === 1) {
      labels[index] = candidate
      continue
    }
    // Suffix-only labels preserve uniqueness when a suffix fills the budget.
    let label
    do {
      const suffix = ` #${(number++).toString(36)}`
      const suffixWidth = textWidth(suffix)
      label = available > suffixWidth
        ? `${truncateName(clean, available - suffixWidth)}${suffix}`
        : `#${(number - 1).toString(36)}`
    } while (reserved.has(label))
    reserved.add(label)
    labels[index] = label
  }
  return labels
}

const displayRow = (item, reserved = false) => ({
  agent: item.agent,
  clean: sanitizeName(item.agent),
  amount: displayAmount(item),
  // Unavailable is already an explicit indication of an unknown total.
  marker: item.knownCost !== null && item.incomplete ? 'e' : ' ',
  reserved,
})

function agentStatsRows(snapshot, sessionID) {
  if (snapshot.sessionID !== sessionID) return [{ text: 'Loading session history…' }]
  const summary = aggregateReportedCostsForDisplay(snapshot)
  const content = summary.agents.map((item) => displayRow(item))
  if (summary.unattributed) {
    content.push(displayRow({ agent: 'Unattributed', ...summary.unattributed }, true))
  }
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
  return content
}

// A compact textual representation remains available to callers that do not
// mount the view. The live view measures its own row instead of using this
// fixed budget.
export function agentStatsLines(snapshot, sessionID) {
  const rows = agentStatsRows(snapshot, sessionID)
  const costRows = rows.filter((item) => !item.text)
  const labels = displayLabels(
    costRows,
    (item) => nameWidth(LABEL_ROW_BUDGET, item.amount.length),
  )
  let next = 0
  return rows.map((item) => {
    if (item.text) return item.text
    // displayLabels already fitted each label to this same budget, so copying it
    // here needs no second truncation. Its suffix-only fallback only appears once
    // a collision suffix is at least as wide as the name budget (16 cells at the
    // narrowest), which needs more rows than a session can hold.
    const label = labels[next++]
    const spaces = Math.max(1, LABEL_ROW_BUDGET - textWidth(label) - 1 - item.amount.length - 1)
    return `${label}:${' '.repeat(spaces)}${item.amount}${item.marker}`
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
  // Row widths are only known after the host lays the section out, and every
  // row is 100% of this box's width. A single resize hook on the persistent
  // content box therefore refits all labels once per layout pass; hooking each
  // row would refit and re-sort every label once per row (O(N^2 log N) during
  // a resize). Use a BoxRenderable: it inherits the base resize behavior,
  // whereas TextBufferRenderable overrides onResize without calling super and
  // would never invoke a text element's onSizeChange callback.
  const rowRefs = []
  const fitRows = () => {
    if (rowRefs.length === 0) return
    const measured = Math.floor(content.width)
    const labels = displayLabels(
      rowRefs.map((ref) => ref.item),
      (item) => measured > 0
        ? nameWidth(measured, item.amount.length)
        : INITIAL_NAME_WIDTH,
    )
    rowRefs.forEach((ref, index) => {
      const next = `${labels[index]}:`
      // Reading `TextRenderable.content` returns a StyledText object, never the
      // string that was set, so compare against the last string applied here.
      if (ref.appliedLabel === next) return
      ref.appliedLabel = next
      ref.label.content = next
    })
  }
  setProp(content, 'onSizeChange', fitRows)
  insert(content, () => {
    revision()
    rowRefs.length = 0
    if (!expanded()) return []
    const rows = agentStatsRows(sessionData.getSnapshot(), input.sessionID).map((item) => {
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
      insert(label, '')
      const value = createElement('text')
      setProp(value, 'fg', color)
      setProp(value, 'width', item.amount.length + 1)
      setProp(value, 'flexShrink', 0)
      insert(value, `${item.amount}${item.marker}`)
      insert(row, label)
      insert(row, value)
      rowRefs.push({ label, item })
      return row
    })
    // Use the conservative initial width before the first layout pass so an
    // untrusted long name cannot overflow; the content resize hook then refits.
    fitRows()
    return rows
  })
  insert(box, content)
  return box
}
