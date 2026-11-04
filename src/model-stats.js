import { createSignal, onCleanup } from 'solid-js'
import { createElement, insert, setProp } from '@opentui/solid'
import { aggregateReportedCostsByModelForDisplay } from './usage-aggregation.js'
import {
  REPLACEMENT_CHARACTER,
  TRUNCATION_MARKER,
  TRUNCATION_MARKER_WIDTH,
  charWidth,
  textWidth,
} from './display-width.js'

// The first fit uses a conservative width before OpenTUI's content-box resize.
const INITIAL_NAME_WIDTH = 16
const INCOMPLETE_MARKER_LEGEND = 'e = estimated'
const UNATTRIBUTED_LABEL = 'Unattributed'
const modelCatalogues = new WeakMap()
const EMPTY_MODEL_CATALOGUE = {
  models: [],
  subscribe: () => () => {},
}

const nameWidth = (rowWidth, amountWidth) => Math.max(1, rowWidth - amountWidth - 3)
// This key is only for visual collision checks; source IDs and rendered text
// retain their original spacing.
const visualLabelKey = (label) => label.replace(/\p{Zs}+/gu, ' ').trim()

function sanitizeName(name) {
  return name.replace(
    /[\p{Cc}\p{Cf}\p{M}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu,
    REPLACEMENT_CHARACTER,
  )
}

// Iterate by code point, not UTF-16 code unit, and account for wide
// characters. Truncation is only presentation: aggregation uses the ID.
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

const compareModels = (a, b) => {
  if (a.model !== b.model) return a.model < b.model ? -1 : 1
  // The reserved Unattributed bucket can sit beside a recorded model ID with
  // the same text. Retain source order to make the collision resolution stable.
  return a.index - b.index
}

// Fit every model label to its own row before checking for collisions. This
// keeps a short ID full when only another row needs shortening.
function displayLabels(rows, availableNameWidth) {
  const entries = rows.map((row, index) => {
    const available = availableNameWidth(row, index)
    return {
      index,
      model: row.model,
      clean: row.clean,
      available,
      reserved: row.reserved === true,
      candidate: row.reserved === true
        ? UNATTRIBUTED_LABEL
        : truncateName(row.clean, available),
    }
  })
  const counts = new Map()
  for (const { candidate } of entries) {
    const key = visualLabelKey(candidate)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  // The bucket label is reserved even when there is no unattributed work yet.
  const unattributedKey = visualLabelKey(UNATTRIBUTED_LABEL)
  const reserved = new Set([unattributedKey])
  for (const { candidate } of entries) {
    const key = visualLabelKey(candidate)
    if (counts.get(key) === 1 && key !== unattributedKey) reserved.add(key)
  }

  const labels = new Array(rows.length)
  let number = 1
  for (const {
    index,
    clean,
    available,
    candidate,
    reserved: isReserved,
  } of entries.sort(compareModels)) {
    if (isReserved) {
      labels[index] = UNATTRIBUTED_LABEL
      continue
    }
    const key = visualLabelKey(candidate)
    if (counts.get(key) === 1 && key !== unattributedKey) {
      labels[index] = candidate
      continue
    }
    let label
    do {
      const suffix = ` #${(number++).toString(36)}`
      const suffixWidth = textWidth(suffix)
      label = available > suffixWidth
        ? `${truncateName(clean, available - suffixWidth)}${suffix}`
        : `#${(number - 1).toString(36)}`
    } while (reserved.has(visualLabelKey(label)))
    reserved.add(visualLabelKey(label))
    labels[index] = label
  }
  return labels
}

function modelsFrom(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return null
}

function createModelCatalogue(context) {
  let models = []
  let attempted = false
  const subscribers = new Set()

  const publish = (next) => {
    if (models === next) return
    models = next
    for (const subscriber of subscribers) {
      try { subscriber() } catch { /* A view must not break catalogue loading. */ }
    }
  }

  const fetchClientModels = () => {
    let result
    try {
      const clientModel = context?.client?.model
      const list = clientModel?.list
      if (typeof list !== 'function') return
      result = list.call(clientModel)
    } catch {
      return
    }

    const synchronous = modelsFrom(result)
    if (synchronous) {
      publish(synchronous)
      return
    }
    Promise.resolve(result).then((value) => {
      const fetched = modelsFrom(value)
      if (fetched) publish(fetched)
    }).catch(() => {})
  }

  const load = () => {
    if (attempted) return
    attempted = true

    let result
    try {
      const locationModel = context?.data?.location?.model
      const list = locationModel?.list
      if (typeof list === 'function') result = list.call(locationModel)
    } catch {
      // Fall through to the client API when the local catalogue is unavailable.
    }

    const synchronous = modelsFrom(result)
    if (synchronous) {
      publish(synchronous)
    } else if (result && typeof result.then === 'function') {
      Promise.resolve(result).then((value) => {
        const fetched = modelsFrom(value)
        if (fetched) {
          publish(fetched)
        } else {
          fetchClientModels()
        }
      }, () => {
        fetchClientModels()
      }).catch(() => {})
    } else {
      fetchClientModels()
    }
  }

  return {
    get models() { return models },
    load,
    subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
}

function modelCatalogueFor(context) {
  if (!context || (typeof context !== 'object' && typeof context !== 'function')) {
    return EMPTY_MODEL_CATALOGUE
  }
  let catalogue = modelCatalogues.get(context)
  if (!catalogue) {
    catalogue = createModelCatalogue(context)
    modelCatalogues.set(context, catalogue)
  }
  // Cache by host context so repeated sidebar renders share one catalogue read.
  catalogue.load()
  return catalogue
}

function usageTimestamp(record) {
  for (const value of [
    record?.startedAt,
    record?.createdAt,
    record?.terminalAt,
    record?.completedAt,
  ]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function earliestUsageByModel(snapshot) {
  const earliest = new Map()
  for (const record of snapshot?.records ?? []) {
    const model = record?.model
    if (typeof model?.id !== 'string' || model.id.trim().length === 0) continue
    const timestamp = usageTimestamp(record)
    const previous = earliest.get(model.id)
    if (!previous || (
      timestamp !== null &&
      (previous.timestamp === null || timestamp < previous.timestamp)
    )) {
      earliest.set(model.id, { providerID: model.providerID, timestamp })
    }
  }
  return earliest
}

function modelCatalogueName(models, modelID, providerID) {
  if (typeof providerID !== 'string' || providerID.trim().length === 0) return modelID
  const entry = models.find((model) =>
    model?.id === modelID && model?.providerID === providerID,
  )
  return typeof entry?.name === 'string' && entry.name.trim().length > 0
    ? entry.name
    : modelID
}

const displayAmount = (item) => item.roundedCost ??
  (item.overflowDirection === 'negative' ? '<-$9999.99' :
    item.overflowDirection === 'positive' ? '>$9999.99' : 'unavailable')

const displayRow = (item, reserved = false, label = item.model) => ({
  model: item.model,
  clean: sanitizeName(label),
  amount: displayAmount(item),
  // An unknown total already says unavailable; only a known partial gets `e`.
  marker: item.knownCost !== null && item.incomplete ? 'e' : ' ',
  reserved,
})

function modelStatsRows(snapshot, sessionID, models = []) {
  if (snapshot.sessionID !== sessionID) return [{ text: 'Loading session history…' }]
  const summary = aggregateReportedCostsByModelForDisplay(snapshot)
  const earliest = earliestUsageByModel(snapshot)
  const content = summary.models.map((item) => {
    const usage = earliest.get(item.model)
    const label = modelCatalogueName(models, item.model, usage?.providerID)
    return displayRow(item, false, label)
  })
  if (summary.unattributed) {
    content.push(displayRow({ model: 'Unattributed', ...summary.unattributed }, true))
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
    } else content.push({ text: 'No model usage recorded' })
  }
  return content
}

// OpenTUI calls the slot renderer from its Solid context. This mirrors the
// host's disclosure indicator and responsive, right-aligned value layout.
export function createModelStatsView(context, sessionData, input, expanded, toggle) {
  const [revision, setRevision] = createSignal(0, { equals: false })
  const unsubscribe = sessionData.subscribe(() => setRevision((value) => value + 1))
  onCleanup(unsubscribe)
  const catalogue = modelCatalogueFor(context)
  const unsubscribeCatalogue = catalogue.subscribe(() => setRevision((value) => value + 1))
  onCleanup(unsubscribeCatalogue)

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
  insert(title, () => `${expanded() ? '▼' : '▶'} Model stats `)
  insert(header, title)
  insert(box, header)

  const content = createElement('box')
  setProp(content, 'flexDirection', 'column')
  setProp(content, 'width', '100%')
  const color = context.theme?.text?.muted ?? context.theme?.text?.base
  const rowRefs = []
  // OpenTUI's content-box onSizeChange hook reports usable width after flex
  // layout; measuring a parent can include space unavailable to row labels.
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
      if (ref.appliedLabel === next) return
      ref.appliedLabel = next
      // Update the existing OpenTUI text node in place; swapping children here
      // can race the host's layout pass that produced the measured width.
      ref.label.content = next
    })
  }
  setProp(content, 'onSizeChange', fitRows)
  insert(content, () => {
    revision()
    rowRefs.length = 0
    if (!expanded()) return []
    const rows = modelStatsRows(
      sessionData.getSnapshot(),
      input.sessionID,
      catalogue.models,
    ).map((item) => {
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
    // The host has not necessarily emitted its first size event yet. Start at
    // a conservative label width, then let the content-box hook expand it.
    fitRows()
    return rows
  })
  insert(box, content)
  return box
}
