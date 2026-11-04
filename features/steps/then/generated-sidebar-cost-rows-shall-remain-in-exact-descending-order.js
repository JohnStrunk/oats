import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { toggle, updateControl } from '../sidebar_scenario_helper.js'
import { assertRenderedRowsInOrder } from '../sidebar_sorting_helper.js'

// Random finite costs are generated as integer microdollars. Carry those
// expected units beside each Number instead of parsing the Number's decimal
// string or reimplementing the production formatter in this test oracle.
const COST_UNITS_PER_DOLLAR = 1_000_000
const numberCost = (value, order) => ({ kind: 'number', value, order })
const scaledCost = units => numberCost(units / COST_UNITS_PER_DOLLAR, {
  kind: 'finite', units: BigInt(units), tiny: 0n,
})
const fixedScaledCost = (value, units) => numberCost(value, {
  kind: 'finite', units: BigInt(units), tiny: 0n,
})
const minimumCost = numberCost(Number.MIN_VALUE, { kind: 'finite', units: 0n, tiny: 1n })
const extremeCost = sign => numberCost(sign * Number.MAX_VALUE, { kind: 'extreme', sign })
const nullCost = { kind: 'null' }
const missingCost = { kind: 'missing' }

const generatedCost = fc.oneof(
  fc.integer({ min: -100_000_000, max: 100_000_000 }).map(scaledCost),
  fc.constant(nullCost),
  fc.constant(missingCost),
)

const generatedGroupCosts = fc.array(generatedCost, { minLength: 2, maxLength: 4 })

function expectedTotal(costs) {
  const numericCosts = costs.filter(cost => cost.kind === 'number')
  if (numericCosts.length === 0) return null

  const extremes = numericCosts.filter(cost => cost.order.kind === 'extreme')
  if (extremes.length > 0) {
    // The fixed extreme cases below are either one finite Number.MAX_VALUE or
    // two positive Number.MAX_VALUE inputs whose numeric aggregate overflows.
    return numericCosts.length === 1 ? extremes[0].order : null
  }

  return numericCosts.reduce((total, cost) => ({
    kind: 'finite',
    units: total.units + cost.order.units,
    tiny: total.tiny + cost.order.tiny,
  }), { kind: 'finite', units: 0n, tiny: 0n })
}

function summarizeCosts(costs) {
  const total = expectedTotal(costs)
  const hasUnavailableCost = costs.some(cost => cost.kind !== 'number')
  return {
    total,
    marker: total !== null && hasUnavailableCost ? 'e' : 'blank',
  }
}

function compareExpectedTotals(left, right) {
  if (left.kind === 'extreme' || right.kind === 'extreme') {
    if (left.kind === 'extreme' && right.kind === 'extreme') return left.sign - right.sign
    if (left.kind === 'extreme') return left.sign
    return -right.sign
  }
  if (left.units !== right.units) return left.units < right.units ? -1 : 1
  if (left.tiny !== right.tiny) return left.tiny < right.tiny ? -1 : 1
  return 0
}

function compareKnownTotalsAscending(left, right) {
  if (left.total === null) return right.total === null ? left.index - right.index : 1
  if (right.total === null) return -1
  return compareExpectedTotals(left.total, right.total) || left.index - right.index
}

function compareReportedTotalsDescending(left, right, insertionOrder) {
  if (left.total === null) {
    return right.total === null
      ? insertionOrder.get(left.key) - insertionOrder.get(right.key)
      : 1
  }
  if (right.total === null) return -1
  return compareExpectedTotals(right.total, left.total) ||
    insertionOrder.get(left.key) - insertionOrder.get(right.key)
}

Then('generated sidebar cost rows shall remain in exact descending order', { timeout: 180000 }, async function () {
  const fixture = this.sidebarFixture
  const template = fixture.messages[fixture.rootSession]?.[0]
  assert.ok(template, 'the fixture must provide a valid session-data record template')
  let generation = 0

  const generatedInputs = fc.record({
    partialUnits: fc.integer({ min: 2_000_000, max: 4_000_000 }),
    generatedGroups: fc.array(generatedGroupCosts, { minLength: 2, maxLength: 3 }),
  })

  await fc.assert(fc.asyncProperty(generatedInputs, async ({ partialUnits, generatedGroups }) => {
    const maximum = extremeCost(1)
    const rawGroups = [
      // These two exact totals both round up to $0.02, but the second is larger.
      { key: 'fracLo', costs: [scaledCost(5_000), scaledCost(5_100)], modelKey: 'sharedFrac' },
      { key: 'fracHi', costs: [scaledCost(9_000), scaledCost(10_900)], modelKey: 'sharedFrac' },
      // Keep Number.MIN_VALUE as an explicit fixed case, outside the random range.
      { key: 'min', costs: [minimumCost], modelKey: 'min' },
      // Null and missing values remain in a known partial group and an unknown-only group.
      { key: 'partial', costs: [scaledCost(partialUnits), nullCost, missingCost], modelKey: 'partial' },
      { key: 'completeTie', costs: [scaledCost(partialUnits)], modelKey: 'completeTie' },
      { key: 'unknown', costs: [nullCost, missingCost], modelKey: 'unknown' },
      { key: 'zero', costs: [scaledCost(0)], modelKey: 'zero' },
      // Explicit fixed cases straddle the positive and negative display limits.
      { key: 'atLimit', costs: [fixedScaledCost(9_999.99, 9_999_990_000n)], modelKey: 'atLimit' },
      { key: 'justOver', costs: [fixedScaledCost(9_999.990001, 9_999_990_001n)], modelKey: 'justOver' },
      { key: 'overLimit', costs: [fixedScaledCost(10_000, 10_000_000_000n)], modelKey: 'overLimit' },
      { key: 'negAtLimit', costs: [fixedScaledCost(-9_999.99, -9_999_990_000n)], modelKey: 'negAtLimit' },
      { key: 'negOver', costs: [fixedScaledCost(-10_000, -10_000_000_000n)], modelKey: 'negOver' },
      { key: 'negMax', costs: [extremeCost(-1)], modelKey: 'negMax' },
      { key: 'max', costs: [maximum], modelKey: 'max' },
      // Finite Number inputs whose numeric sum overflows have an unknown total.
      { key: 'overflow', costs: [maximum, maximum], modelKey: 'overflow' },
      ...generatedGroups.map((costs, index) => ({
        key: `gen${index}`,
        costs,
        modelKey: `generated${index}`,
      })),
    ].map((group, index) => ({
      ...group,
      index,
      ...summarizeCosts(group.costs),
    }))

    // Supply records in ascending expected-total order, the opposite of the
    // required rendering order. Unknown groups follow every known negative;
    // exact ties preserve first-seen identity order.
    const inputGroups = [...rawGroups].sort(compareKnownTotalsAscending)
    const agentInsertionOrder = new Map(inputGroups.map((group, index) => [group.key, index]))
    const expectedAgentGroups = [...rawGroups].sort((left, right) =>
      compareReportedTotalsDescending(left, right, agentInsertionOrder))

    // These Agent groups share one recorded model. Sum their independently
    // carried integer-unit costs to derive Model order without reusing Agent order.
    const modelGroups = new Map()
    for (const group of inputGroups) {
      let modelGroup = modelGroups.get(group.modelKey)
      if (!modelGroup) {
        modelGroup = { key: group.modelKey, costs: [] }
        modelGroups.set(group.modelKey, modelGroup)
      }
      modelGroup.costs.push(...group.costs)
    }
    const expectedModelGroups = [...modelGroups.values()].map(group => ({
      ...group,
      ...summarizeCosts(group.costs),
    }))
    const modelInsertionOrder = new Map(expectedModelGroups.map((group, index) => [group.key, index]))
    expectedModelGroups.sort((left, right) =>
      compareReportedTotalsDescending(left, right, modelInsertionOrder))

    const run = generation++
    const records = []

    for (const group of inputGroups) {
      const agent = `a${run}-${group.key}`
      const model = `m${run}-${group.modelKey}`
      for (const [recordIndex, cost] of group.costs.entries()) {
        const record = {
          ...template,
          id: `sort-generated-${run}-${group.key}-${recordIndex}`,
          agent,
          model: { providerID: 'generated-provider', id: model },
        }
        if (cost.kind === 'number') record.cost = cost.value
        else if (cost.kind === 'null') record.cost = null
        else delete record.cost
        records.push(record)
      }
    }

    await updateControl(this, current => {
      current.messages = { [current.rootSession]: records }
      current.events.push({
        id: `sort-generated-refresh-${run}`,
        type: 'session.moved',
        data: { sessionID: current.rootSession },
      })
    })

    const expectedAgentRows = expectedAgentGroups.map(group => ({
      name: `a${run}-${group.key}`,
      marker: group.marker,
    }))
    const expectedModelRows = expectedModelGroups.map(group => ({
      name: `m${run}-${group.key}`,
      marker: group.marker,
    }))
    await assertRenderedRowsInOrder(this, 'Agent', expectedAgentRows)
    await toggle(this, 'keyboard', 'Agent stats')
    await assertRenderedRowsInOrder(this, 'Model', expectedModelRows)
    await toggle(this, 'keyboard', 'Agent stats')
  }), { numRuns: 16, seed: 540054, endOnFailure: true })
})
