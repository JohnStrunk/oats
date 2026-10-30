// Shared fixtures for issue #5 unit tests. The aggregation boundary is the
// scoped, deduplicated snapshot supplied by session data access; these helpers
// keep the tests focused on reported-cost semantics rather than snapshot shape.
import { aggregateReportedCosts } from '../../src/usage-aggregation.js'

export const record = (id, agent, cost, overrides = {}) => ({
  id,
  sessionID: 'root',
  agent,
  cost,
  ...overrides,
})

export const snapshot = (records, overrides = {}) => ({
  sessionID: 'root',
  complete: true,
  gaps: [],
  errors: [],
  records,
  ...overrides,
})

// Awaiting keeps the tests valid whether the implementation is synchronous or
// asynchronous; the QA step helper adopts the same call shape.
export const aggregate = aggregateReportedCosts

export const summarize = async (records, overrides) =>
  aggregate(snapshot(records, overrides))

export const entryFor = (result, name) =>
  result.agents.find((entry) => entry.agent === name)

export const sortedTotals = (result) =>
  result.agents
    .map(({ agent, knownCost }) => [agent, knownCost])
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

export function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}
