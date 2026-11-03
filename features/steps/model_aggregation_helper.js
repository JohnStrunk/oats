import assert from 'node:assert/strict'

// This component boundary consumes the scoped session-data snapshot and
// returns model rows with the same reported-cost fields as Agent stats:
// { sessionID, models: [{ model, knownCost, incomplete, roundedCost }],
//   unattributed, incomplete }.
export async function aggregateModels(snapshot) {
  const boundary = await import('../../src/usage-aggregation.js')
  assert.equal(
    typeof boundary.aggregateReportedCostsByModelForDisplay,
    'function',
    'the usage-aggregation boundary must expose displayed reported-cost totals by recorded model identifier',
  )
  return boundary.aggregateReportedCostsByModelForDisplay(snapshot)
}
