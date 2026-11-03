const LEGEND = 'e = estimated'
const STATUS = /^\s*(?:Loading session history…|No (?:model|session)?\s*usage recorded|No model history recorded|Session history unavailable)\s*$/i

export function modelStatsSectionLines(text) {
  const lines = text.split('\n')
  const headingIndex = lines.findIndex(line => line.includes('Model stats'))
  if (headingIndex < 0) return []
  const start = Math.max(0, lines[headingIndex].indexOf('Model stats') - 3)
  const result = []
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^[\s│┃]*[▾▸▼▶]\s+(?:Agent|Model) stats\b/.test(line)) break
    const content = line.slice(start)
    if (!content.trim()) break
    result.push(content)
  }
  return result
}

export function modelStatsHeadingIndicator(text) {
  const heading = text.split('\n').find(line => line.includes('Model stats')) ?? ''
  return heading.match(/[▾▸▼▶]/)?.[0]
}

export function modelStatsCollapsed(text) {
  const heading = text.split('\n').find(line => line.includes('Model stats')) ?? ''
  return /[▸▶]\s+Model stats\b/.test(heading)
}

function displayedValue(line) {
  return line.match(/(?:\s|:)([<>]?-?\$-?\d+\.\d{2}|unavailable|unknown)(?=e(?:\s|[│┃]|$)|\s|[│┃]|$)/i)?.[1] ?? null
}

function modelRow(line) {
  const match = line.match(/^\s*[│┃]?\s*(.+?)(?:\s*:\s*|\s{2,})((?:[<>]?-?\$\s*[-+\d.]|unavailable\b|unknown\b).*)$/i)
  if (!match) return null
  const value = displayedValue(line) ?? match[2].trim().match(/^(?:unavailable|unknown)\b/i)?.[0] ?? null
  const tail = match[2].trim()
  const amount = typeof value === 'string' && value.startsWith('$') && !value.startsWith('<') && !value.startsWith('>')
    ? Number(value.slice(1))
    : null
  const marker = /^(?:[<>]?-?\$-?\d+\.\d{2})e\s*[│┃]?\s*$/.test(tail) ? 'e' : 'blank'
  return { name: match[1].trim(), line, tail, value, amount, marker }
}

export function modelSidebarRows(text) {
  if (modelStatsCollapsed(text)) return []
  return modelStatsSectionLines(text).map(modelRow).filter(Boolean)
}

// Unlike modelSidebarRows, this check deliberately inspects the raw section
// body even when the heading is collapsed, so stale rows cannot pass a
// hide-while-collapsed assertion just because the visible-row parser gates on
// the heading glyph.
export function modelStatsSectionHasRow(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const label = new RegExp(`^\\s*[│┃]?\\s*${escaped}(?=$|[\\s:])`, 'i')
  return modelStatsSectionLines(text).some(line => label.test(line))
}

export function modelStatsRowsMatch(text, expected) {
  if (!text.split('\n').some(line => line.includes('Model stats')) || modelStatsCollapsed(text)) return false
  const lines = modelStatsSectionLines(text)
  if (lines.some(line => !modelRow(line) && line.trim() !== LEGEND && !STATUS.test(line))) return false
  const rows = lines.map(modelRow).filter(Boolean)
  if (rows.some(row => !/^(?:[<>]?-?\$-?\d+\.\d{2}e?|unavailable)\s*[│┃]?\s*$/.test(row.tail))) return false
  const hasMarker = rows.some(row => row.marker === 'e')
  if (lines.filter(line => line.trim() === LEGEND).length !== (hasMarker ? 1 : 0)) return false
  if (rows.length !== expected.size) return false
  return rows.every(row => {
    if (!expected.has(row.name)) return false
    const value = expected.get(row.name)
    return typeof value === 'number' ? row.amount === value : row.value === value
  }) && [...expected.keys()].every(name => rows.filter(row => row.name === name).length === 1)
}

export function modelStatsHistoryState(text, state) {
  if (modelStatsCollapsed(text)) return false
  const lines = modelStatsSectionLines(text).filter(line => !modelRow(line) && line.trim() !== LEGEND)
  const status = lines.join(' ')
  const loading = /\bloading\b/i.test(status)
  const unavailable = /\b(?:unavailable|failed|error)\b/i.test(status)
  const empty = /\bno (?:model|session)?\s*usage recorded\b|\bno model history recorded\b|\bempty\b/i.test(status)
  if (state === 'loading') return loading && !empty && !unavailable
  if (state === 'empty') return empty && !loading && !unavailable
  if (state === 'unavailable') return unavailable && !empty && !loading
  throw new Error(`unsupported Model stats history state: ${state}`)
}

export function modelStatsLegendCount(text) {
  if (modelStatsCollapsed(text)) return 0
  return modelStatsSectionLines(text).filter(line => line.trim() === LEGEND).length
}

export function modelStatsIncomplete(text, name) {
  const matches = modelSidebarRows(text).filter(row => row.name === name)
  if (matches.length !== 1 || matches[0].marker !== 'e') return false
  return modelStatsLegendCount(text) === 1
}

export function modelSummaryNoticeAbsent(text) {
  const heading = text.split('\n').find(line => line.includes('Model stats'))
  if (!heading || modelStatsCollapsed(text) || /Summary incomplete/i.test(heading)) return false
  return !modelStatsSectionLines(text).some(line =>
    !modelRow(line) && line.trim() !== LEGEND && !STATUS.test(line))
}
