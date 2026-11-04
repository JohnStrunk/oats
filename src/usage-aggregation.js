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
// roundedCost on each identity group and on the unattributed bucket. roundedCost
// sums the reported numbers' shortest decimal representations exactly and rounds
// the total once toward positive infinity to cents. knownCost and every other
// field retain the aggregation's numeric behavior, including overflow. When
// the exact total exceeds the display bound, roundedCost is null and
// overflowDirection identifies which bound was exceeded.
export function aggregateReportedCostsForDisplay(snapshot) {
  return aggregateSnapshot(snapshot, true)
}

export function aggregateReportedCostsByModelForDisplay(snapshot) {
  return aggregateSnapshotByModel(snapshot, true)
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
  return aggregateByIdentity(snapshot, includeRounded, {
    field: 'agent',
    collection: 'agents',
    getIdentity: (record) => record?.agent,
  })
}

function aggregateSnapshotByModel(snapshot, includeRounded) {
  return aggregateByIdentity(snapshot, includeRounded, {
    field: 'model',
    collection: 'models',
    getIdentity: (record) => record?.model?.id,
  })
}

function aggregateByIdentity(snapshot, includeRounded, grouping) {
  const groups = new Map()
  let unattributed = null

  const makeGroup = () => ({ costs: [], incomplete: false })
  for (const record of snapshot?.records ?? []) {
    const identity = grouping.getIdentity(record)
    let group
    if (typeof identity === 'string' && identity.trim().length > 0) {
      group = groups.get(identity)
      if (!group) {
        group = makeGroup()
        groups.set(identity, group)
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

  function summarize(group, identityField, identity) {
    // Summing in a fixed magnitude order makes the result independent of
    // record order and avoids losing small contributions unnecessarily.
    group.costs.sort((a, b) => {
      const magnitudeA = Math.abs(a)
      const magnitudeB = Math.abs(b)
      if (magnitudeA !== magnitudeB) return magnitudeA < magnitudeB ? -1 : 1
      return a < b ? -1 : a > b ? 1 : 0
    })
    const fields = identityField ? { [identityField]: identity } : {}
    let knownCost = group.costs.length ? 0 : null
    for (const cost of group.costs) {
      knownCost += cost
      if (!Number.isFinite(knownCost)) {
        // An overflowing total is not a usable known cost. Do not return
        // Infinity or silently present an arbitrary partial sum as the total.
        return withRounded(
          { ...fields, knownCost: null, incomplete: true },
          group,
          includeRounded,
        )
      }
    }
    return withRounded(
      { ...fields, knownCost, incomplete: group.incomplete },
      group,
      includeRounded,
    )
  }

  const entries = Array.from(groups, ([identity, group]) =>
    summarize(group, grouping.field, identity))
  const unattributedSummary = unattributed ? summarize(unattributed) : null
  return {
    sessionID: snapshot?.sessionID ?? null,
    [grouping.collection]: entries,
    unattributed: unattributedSummary,
    incomplete:
      snapshot?.complete !== true ||
      (snapshot?.gaps?.length ?? 0) > 0 ||
      (snapshot?.errors?.length ?? 0) > 0 ||
      entries.some((entry) => entry.incomplete) ||
      unattributedSummary !== null,
  }
}

// Keep each display row's exact-total comparison key beside it without adding
// fields to the published summary shape. A symbol distinguishes a display row
// whose total is unknown from a row that was never produced by a display
// aggregation. Ordering must receive the same row objects returned by the
// display aggregation; copying a row would drop this association.
const UNKNOWN_EXACT_COST = Symbol('unknown exact reported cost')
const exactCostKeyByRow = new WeakMap()

function withRounded(summary, group, includeRounded) {
  if (!includeRounded) return summary
  const exact = summary.knownCost === null ? null : sumExactDecimals(group.costs)
  const roundedCost = exact === null ? null : formatExactCents(exact)
  const row = {
    ...summary,
    roundedCost,
    ...(exact !== null && roundedCost === null
      ? { overflowDirection: exact.units < 0n ? 'negative' : 'positive' }
      : {}),
  }
  exactCostKeyByRow.set(
    row,
    exact === null ? UNKNOWN_EXACT_COST : exactComparisonKey(exact),
  )
  return row
}

// Finite JS numbers render as shortest decimals with exponents between
// -324 (Number.MIN_VALUE) and 308 (for example, 1e308). Number.MAX_VALUE has
// exponent 292 because its shortest decimal has 17 significant digits.
// Scaling an exact total to this fixed decimal place yields an integer whose
// BigInt order is the exact total's order, so comparisons need no
// per-comparator exponent alignment. The required power is between 0 and 632;
// computing it once per display row keeps sorting cheap.
const EXACT_COST_KEY_EXPONENT = -324

function exactComparisonKey({ units, exponent }) {
  return units * 10n ** BigInt(exponent - EXACT_COST_KEY_EXPONENT)
}

function compareExactCostDescending(left, right) {
  if (left === UNKNOWN_EXACT_COST) {
    return right === UNKNOWN_EXACT_COST ? 0 : 1
  }
  if (right === UNKNOWN_EXACT_COST) return -1
  return left < right ? 1 : left > right ? -1 : 0
}

/**
 * Order display rows by exact reported total, descending.
 *
 * Accepts only row objects returned by aggregateReportedCostsForDisplay or
 * aggregateReportedCostsByModelForDisplay, plus that summary's optional
 * unattributed bucket. Rows from the non-display aggregation, spread copies,
 * and any other object have no display comparison key and throw a TypeError.
 *
 * The unattributed bucket participates with its own total and follows an equal
 * total from the rows, matching its position at the end of the display input.
 * Unknown totals (unknown-only groups and numeric overflow) follow every known
 * total, while a finite display-bound overflow still sorts by its exact total.
 * Equal exact totals retain input order through the explicit original index.
 */
export function orderReportedCostRows(rows, unattributed = null) {
  const ordered = unattributed ? [...rows, unattributed] : [...rows]
  return ordered
    .map((row, index) => ({ row, index, key: comparisonKeyFor(row) }))
    .sort((left, right) =>
      compareExactCostDescending(left.key, right.key) || left.index - right.index)
    .map(({ row }) => row)
}

function comparisonKeyFor(row) {
  if (!exactCostKeyByRow.has(row)) {
    throw new TypeError(
      'orderReportedCostRows requires rows returned by a display aggregation',
    )
  }
  return exactCostKeyByRow.get(row)
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

// The shortest-decimal exponent spread of finite doubles is bounded by
// -324..308, so every alignment power stays bounded even at either extreme.
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
