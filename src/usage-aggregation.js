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
        return { knownCost: null, incomplete: true }
      }
    }
    return { knownCost, incomplete: group.incomplete }
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
