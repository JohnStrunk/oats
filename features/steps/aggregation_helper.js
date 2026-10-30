// Component boundaries: aggregateReportedCosts(snapshot) returns
// { sessionID, agents: [{ agent, knownCost, incomplete }], unattributed,
//   incomplete }. `unattributed` is null or { knownCost, incomplete }.
// knownCost is null if no individual cost is known; zero remains a number.
// The input is the public session-data snapshot, already scoped and deduplicated
// by session-data-access. This function does not invent provider billing data.
// A gap that cannot be assigned to a specific agent makes the overall summary
// incomplete, not every agent. An agent is incomplete for missing or ambiguous
// costs attributable to that agent's own records. A reported zero is known and
// does not itself make an agent incomplete or establish that billing was free.
// createUsageAggregation(sessionData).getSummary() reads the latest snapshot
// on each request. It does not promise a reactive callback or a reporting UI.
export async function aggregate(snapshot) {
  const { aggregateReportedCosts } = await import('../../src/usage-aggregation.js')
  return aggregateReportedCosts(snapshot)
}
