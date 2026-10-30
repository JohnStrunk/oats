// Read the source each time rather than caching a summary: the source changes
// on host updates and route changes, and has no snapshot subscription API.
// The caller retains ownership of the supplied service and its lifecycle.
export function createUsageAggregation(sessionData) {
  return {
    getSummary: () => aggregateReportedCosts(sessionData.getSnapshot()),
  }
}

// Aggregate only the scoped, deduplicated records supplied by session data
// access. Gap metadata may describe overlapping work and is not another cost.
export function aggregateReportedCosts(snapshot) {
  return aggregateSnapshot(snapshot, false)
}

// Display consumers receive the same summary as aggregateReportedCosts, plus
// roundedCost on each agent and on the unattributed bucket. roundedCost sums
// the reported numbers' shortest decimal representations exactly and rounds
// the total once toward positive infinity to cents. knownCost and every other
// field retain the aggregation's numeric behavior, including overflow. When
// the exact total exceeds the display bound, roundedCost is null and
// overflowDirection identifies which bound was exceeded.
export function aggregateReportedCostsForDisplay(snapshot) {
  return aggregateSnapshot(snapshot, true)
}

// The sidebar reserves room for six cent digits. A larger exact total cannot
// be shown as a bounded dollar amount, so callers render an overflow marker.
// shortcut: fixed sidebar display bound, upgrade when the presentation grows.
const MAX_DISPLAY_CENTS = 999_999n
const MAX_DISPLAY_AMOUNT = '$9999.99'

export function formatReportedCost(cost) {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return 'unavailable'
  const formatted = formatExactCents(sumExactDecimals([cost]))
  return formatted ?? (cost < 0 ? `<-${MAX_DISPLAY_AMOUNT}` : `>${MAX_DISPLAY_AMOUNT}`)
}

function aggregateSnapshot(snapshot, includeRounded) {
  const groups = new Map()
  let unattributed = null

  const makeGroup = () => ({ costs: [], incomplete: false })
  for (const record of snapshot?.records ?? []) {
    const agent = record?.agent
    let group
    if (typeof agent === 'string' && agent.trim().length > 0) {
      group = groups.get(agent)
      if (!group) {
        group = makeGroup()
        groups.set(agent, group)
      }
    } else {
      unattributed ??= makeGroup()
      group = unattributed
    }

    const cost = record?.cost
    if (typeof cost === 'number' && Number.isFinite(cost)) {
      group.costs.push(cost)
    } else {
      group.incomplete = true
    }
  }

  function summarize(group) {
    // Summing in a fixed magnitude order makes the result independent of
    // record order and avoids losing small contributions unnecessarily.
    group.costs.sort((a, b) => {
      const magnitudeA = Math.abs(a)
      const magnitudeB = Math.abs(b)
      if (magnitudeA !== magnitudeB) return magnitudeA < magnitudeB ? -1 : 1
      return a < b ? -1 : a > b ? 1 : 0
    })
    let knownCost = group.costs.length ? 0 : null
    for (const cost of group.costs) {
      knownCost += cost
      if (!Number.isFinite(knownCost)) {
        // An overflowing total is not a usable known cost. Do not return
        // Infinity or silently present an arbitrary partial sum as the total.
        return withRounded({ knownCost: null, incomplete: true }, group, includeRounded)
      }
    }
    return withRounded(
      { knownCost, incomplete: group.incomplete },
      group,
      includeRounded,
    )
  }

  const agents = Array.from(groups, ([agent, group]) => ({
    agent,
    ...summarize(group),
  }))
  const unattributedSummary = unattributed ? summarize(unattributed) : null
  return {
    sessionID: snapshot?.sessionID ?? null,
    agents,
    unattributed: unattributedSummary,
    incomplete:
      snapshot?.complete !== true ||
      (snapshot?.gaps?.length ?? 0) > 0 ||
      (snapshot?.errors?.length ?? 0) > 0 ||
      agents.some((entry) => entry.incomplete) ||
      unattributedSummary !== null,
  }
}

function withRounded(summary, group, includeRounded) {
  if (!includeRounded) return summary
  const exact = summary.knownCost === null ? null : sumExactDecimals(group.costs)
  const roundedCost = exact === null ? null : formatExactCents(exact)
  return {
    ...summary,
    roundedCost,
    ...(exact !== null && roundedCost === null
      ? { overflowDirection: exact.units < 0n ? 'negative' : 'positive' }
      : {}),
  }
}

// A finite JS number's toString is its shortest round-tripping decimal. Keep
// that decimal as an integer coefficient and a base-10 exponent, avoiding the
// binary value that would add artifacts such as 0.1 + 0.2 = 0.30000000000000004.
function decimalParts(value) {
  const text = value.toString()
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text
  const [mantissa, exponentText = '0'] = unsigned.split('e')
  const [integer, fraction = ''] = mantissa.split('.')
  const digits = BigInt(integer + fraction)
  return {
    units: negative ? -digits : digits,
    exponent: Number(exponentText) - fraction.length,
  }
}

// The exponent spread of finite doubles is small (about -324..292), so every
// alignment power stays bounded even for Number.MIN_VALUE and Number.MAX_VALUE.
export function sumExactDecimals(costs) {
  let exponent = Infinity
  const parts = []
  for (const cost of costs) {
    const part = decimalParts(cost)
    parts.push(part)
    if (part.exponent < exponent) exponent = part.exponent
  }

  let units = 0n
  for (const part of parts) {
    units += part.units * 10n ** BigInt(part.exponent - exponent)
  }
  return { units, exponent }
}

export function formatExactCents({ units, exponent }) {
  const cents = ceilCents(units, exponent)
  if (cents > MAX_DISPLAY_CENTS || cents < -MAX_DISPLAY_CENTS) return null
  if (cents === 0n) return '$0.00'

  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  return `$${negative ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

// ceil(units * 10^exponent * 100), exactly. BigInt division truncates toward
// zero, which is already the ceiling for negative values.
function ceilCents(units, exponent) {
  const shift = exponent + 2
  if (shift >= 0) return units * 10n ** BigInt(shift)

  const divisor = 10n ** BigInt(-shift)
  const quotient = units / divisor
  return units > 0n && units % divisor !== 0n ? quotient + 1n : quotient
}
