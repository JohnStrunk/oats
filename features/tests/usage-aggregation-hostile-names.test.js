import assert from 'node:assert/strict'
import test from 'node:test'
import {
  entryFor,
  record,
  sortedTotals,
  summarize,
} from './usage-aggregation-fixtures.js'

test('keeps __proto__ as an ordinary agent name', async () => {
  const result = await summarize([
    record('1', '__proto__', 2),
    record('2', '__proto__', 3),
  ])

  assert.equal(result.agents.length, 1)
  assert.deepEqual(entryFor(result, '__proto__'), {
    agent: '__proto__',
    knownCost: 5,
    incomplete: false,
  })
  assert.equal(Object.prototype.knownCost, undefined)
  assert.equal({}.knownCost, undefined)
})

test('keeps names that collide with object properties as agents', async () => {
  const names = ['constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf']
  const result = await summarize(
    names.map((name, index) => record(`record-${index}`, name, index + 1)),
  )

  assert.equal(result.agents.length, names.length)
  for (const [index, name] of names.entries()) {
    assert.deepEqual(entryFor(result, name), {
      agent: name,
      knownCost: index + 1,
      incomplete: false,
    })
  }
  assert.equal(Object.prototype.cost, undefined)
})

test('preserves hostile unicode and control characters in agent names', async () => {
  const names = [
    'e\u0301',
    '\u202Eevil',
    '💥agent',
    'line\nbreak',
    'nul\0byte',
    'x'.repeat(10000),
  ]
  const result = await summarize(
    names.map((name, index) => record(`record-${index}`, name, index + 1)),
  )

  assert.equal(result.agents.length, names.length)
  for (const [index, name] of names.entries()) {
    const entry = entryFor(result, name)
    assert.ok(entry, `agent name was not preserved: ${JSON.stringify(name)}`)
    assert.equal(entry.agent, name)
    assert.equal(entry.knownCost, index + 1)
    assert.equal(entry.incomplete, false)
  }
})

test('does not trim, case-fold, or otherwise normalize recorded names', async () => {
  const names = ['alpha', 'alpha ', ' Alpha', 'Alpha', '\u00A0alpha\u00A0']
  const result = await summarize(
    names.map((name, index) => record(`record-${index}`, name, index + 1)),
  )

  assert.deepEqual(sortedTotals(result), [
    [' Alpha', 3],
    ['Alpha', 4],
    ['alpha', 1],
    ['alpha ', 2],
    ['\u00A0alpha\u00A0', 5],
  ])
})

test('treats blank agent names as unavailable identity, preserving their cost', async () => {
  const result = await summarize([
    record('1', '', 1),
    record('2', '   ', 2),
    record('3', '\t', 3),
    record('4', '\n', 4),
  ])

  assert.deepEqual(result.agents, [])
  assert.equal(result.unattributed.knownCost, 10)
  assert.equal(result.unattributed.incomplete, false)
})

test('keeps names that resemble the unattributed bucket distinct from it', async () => {
  const result = await summarize([
    record('1', 'unattributed', 1),
    record('2', 'null', 2),
    record('3', 'undefined', 3),
    record('4', null, 4),
  ])

  assert.deepEqual(sortedTotals(result), [
    ['null', 2],
    ['unattributed', 1],
    ['undefined', 3],
  ])
  assert.equal(result.unattributed.knownCost, 4)
})

test('treats non-string identities as unavailable instead of coercing them', async () => {
  const result = await summarize([
    record('1', null, 1),
    record('2', undefined, 1),
    record('3', 7, 1),
    record('4', false, 1),
    record('5', {}, 1),
    record('6', [], 1),
    record('7', '0', 10),
  ])

  assert.deepEqual(sortedTotals(result), [['0', 10]])
  assert.equal(result.unattributed.knownCost, 6)
  assert.equal(result.unattributed.incomplete, false)
})
