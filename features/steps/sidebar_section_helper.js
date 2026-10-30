// Only examine the rendered section body. The first blank sidebar line closes
// this section; other host sections or footer text must not count as its rows.
export function sidebarSectionLines(text) {
  const lines = text.split('\n')
  const headingIndex = lines.findIndex(line => line.includes('Agent stats'))
  if (headingIndex < 0) return []
  const start = Math.max(0, lines[headingIndex].indexOf('Agent stats') - 3)
  const result = []
  for (const line of lines.slice(headingIndex + 1)) {
    const content = line.slice(start)
    if (!content.trim()) break
    result.push(content)
  }
  return result
}

// Keep the raw section lines available to detect stale content beneath a
// collapsed heading, but never count that content as an expanded-section row
// or status. In particular, an apparent row and legend below the heading must
// not satisfy positive visibility assertions.
export function sectionIsCollapsed(text) {
  const heading = text.split('\n').find(line => line.includes('Agent stats')) ?? ''
  return /[▸▶]\s+Agent stats(?:\s|$)/.test(heading)
}

export function rowsFor(text, name) {
  if (sectionIsCollapsed(text)) return []
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const row = new RegExp(`^\\s*[│┃]?\\s*${escaped}(?=$|[\\s:])`, 'i')
  return sidebarSectionLines(text).filter(line => row.test(line))
}

export function rowFor(text, name) {
  return rowsFor(text, name)[0]
}

export function amountFor(row) {
  const value = displayedValue(row)
  const found = value?.match(/^\$([-+]?[0-9]+(?:\.[0-9]+)?(?:e[-+]?[0-9]+)?)$/i)
  return found ? Number(found[1]) : null
}

// Capture the entire rendered value, including a directional prefix. Never
// find a dollar substring inside a bound and mistake it for an exact amount.
export function displayedValue(row) {
  const match = row?.match(/(?:\s|:)([<>]?-?\$[-+]?[0-9]+(?:\.[0-9]+)?)(?=e(?:\s|[│┃]|$)|\s|[│┃]|$)/)
  return match?.[1] ?? null
}

function agentRow(line) {
  // A single space before "unavailable" is also used in history status
  // messages. Require a colon or a visible column gap to avoid treating those
  // messages as cost rows; still fail closed on unrecognized extra rows.
  const match = line.match(/^\s*[│┃]?\s*(.+?)(?:\s*:\s*|\s{2,})((?:[<>]?-?\$\s*[-+\d.]|unavailable\b|unknown\b).*)$/i)
  return match ? { name: match[1].trim(), line, tail: match[2], cost: amountFor(line), value: displayedValue(line) } : null
}

const isIncompleteLegend = line => line.trim() === 'e = incomplete total'
const hasIncompleteMarker = value => /\$-?\d+\.\d{2}e(?=\s|[│┃]|$)/.test(value)

export function sidebarAgentRows(text) {
  if (sectionIsCollapsed(text)) return []
  return sidebarSectionLines(text).map(agentRow).filter(Boolean)
}

export function sidebarRowsMatch(text, expected) {
  if (sectionIsCollapsed(text)) return false
  const lines = sidebarSectionLines(text)
  // Fail closed for an unrecognized displayed row, rather than silently
  // dropping an invented agent whose value is malformed or lacks a dollar
  // sign. Summary/history status lines are not agent rows.
  if (lines.some(line => !agentRow(line) && !isIncompleteLegend(line) && !/^\s*(?:summary|history)\b(?!\s*:)/i.test(line))) return false
  const actual = lines.map(agentRow).filter(Boolean)
  if (actual.some(row => !/^(?:[<>]?-?\$-?\d+\.\d{2}e?|unavailable)\s*[│┃]?\s*$/.test(row.tail))) return false
  const markers = actual.some(row => hasIncompleteMarker(row.tail))
  if (lines.filter(isIncompleteLegend).length !== (markers ? 1 : 0)) return false
  if (actual.length !== expected.size) return false
  return actual.every(({ name, cost, value }) => expected.has(name) &&
    (typeof expected.get(name) === 'string' ? expected.get(name) === value : expected.get(name) === cost && value?.startsWith('$'))) &&
    [...expected.keys()].every(name => actual.filter(row => row.name === name).length === 1)
}

export function agentIncomplete(text, name) {
  const row = rowFor(text, name)
  if (!row) return false
  // The label is not a status: an agent named "partial" or "unknown" is
  // not evidence of incomplete data. Inspect only the value after its label.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = row.match(new RegExp(`^\\s*[│┃]?\\s*${escaped}(?:\\s*:\\s*|\\s+)(.*)$`, 'i'))
  if (!match) return false
  const value = match[1]
  const marked = /^[<>]?-?\$-?\d+\.\d{2}e\s*[│┃]?\s*$/.test(value)
  if (marked && sidebarSectionLines(text).filter(isIncompleteLegend).length !== 1) return false
  return marked || /^unavailable\s*[│┃]?\s*$/i.test(value)
}

function statusText(text) {
  return sidebarSectionLines(text).filter(line => !agentRow(line)).join(' ')
}

export function summaryIncomplete(text) {
  if (sectionIsCollapsed(text)) return false
  return sidebarSectionLines(text).filter(line => !agentRow(line)).some(line =>
    /\bsummary\b.*\b(?:incomplete|partial|unavailable)\b|\b(?:incomplete|partial|unavailable)\b.*\bsummary\b/i.test(line))
}

export function historyState(text, state) {
  if (sectionIsCollapsed(text)) return false
  const statusLines = sidebarSectionLines(text).filter(line => !agentRow(line))
  const status = statusLines.join(' ')
  const loading = /\bloading\b/i.test(status)
  const unavailable = /\b(?:unavailable|failed|error)\b/i.test(status)
  const empty = /\bno (?:agent|usage|history)\b|\bempty\b/i.test(status)
  const historyLoadingPattern = /^\s*(?:loading\s+(?:session\s+)?history\b|(?:session\s+)?history(?:\s+is)?\s+loading\b)/i
  const historyLoading = statusLines.some((line, index) =>
    historyLoadingPattern.test(line) ||
    (index + 1 < statusLines.length && historyLoadingPattern.test(`${line.trim()} ${statusLines[index + 1].trim()}`)))
  const historyUnavailable = statusLines.some((line, index) =>
    /\bhistory(?:\s+(?:is|was))?\s+(?:unavailable|failed|error)\b|\b(?:failed|error)\s+to\s+(?:load|read)\s+(?:session\s+)?history\b/i.test(line) ||
    (/\bhistory\s*$/i.test(line) && /^\s*(?:unavailable|failed|error)\b/i.test(statusLines[index + 1] ?? '')))
  if (state === 'loading') return historyLoading && !empty && !unavailable
  if (state === 'empty') return empty && !loading && !unavailable
  if (state === 'unavailable') return historyUnavailable && !empty && !loading
  throw new Error(`unsupported history state: ${state}`)
}

export function collapsedWithoutContent(text) {
  const heading = text.split('\n').find(line => line.includes('Agent stats')) ?? ''
  return /[▸▶]/.test(heading) && sidebarSectionLines(text).length === 0
}

export async function rowsRemain(readScreen, expected, { durationMs = 500, pollMs = 25 } = {}) {
  const deadline = Date.now() + durationMs
  do {
    if (!sidebarRowsMatch(readScreen(), expected)) return false
    if (Date.now() >= deadline) return true
    await new Promise(resolve => setTimeout(resolve, pollMs))
  } while (true)
}
