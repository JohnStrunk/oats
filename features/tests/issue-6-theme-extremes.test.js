import assert from 'node:assert/strict'
import test from 'node:test'
import { agentStatsLines, formatCost } from '../../src/agent-stats.js'

test('extreme finite amounts use bounded upward-rounded or overflow notation', () => {
  assert.equal(formatCost(Number.MIN_VALUE), '$0.01')
  assert.equal(formatCost(1e-308), '$0.01')
  assert.equal(formatCost(-Number.MIN_VALUE), '$0.00')
  assert.equal(formatCost(1e308), '>$9999.99')
  assert.equal(formatCost(Number.MAX_VALUE), '>$9999.99')
  assert.equal(formatCost(-1e308), '<-$9999.99')
  assert.equal(formatCost(0), '$0.00')
  assert.equal(formatCost(1.25), '$1.25')
  assert.equal(formatCost(0.0001), '$0.01')
})

test('an extreme cost and incomplete marker fit in the host 30-column row', () => {
  for (const cost of [Number.MIN_VALUE, 1e308, -1e308]) {
    const records = [{ agent: 'abcdefghijklmnop', cost }, { agent: 'abcdefghijklmnop', cost: null }]
    const lines = agentStatsLines({ sessionID: 'root', complete: false, errors: [], gaps: [], records }, 'root')
    const line = lines.find(value => value.includes(formatCost(cost)))
    assert.ok(line)
    assert.match(line, /\(incomplete\)$/)
    assert.ok(Array.from(line).length <= 30, line)
  }
})
