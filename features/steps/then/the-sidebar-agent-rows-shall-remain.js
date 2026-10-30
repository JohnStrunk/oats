import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'
import { rowsRemain, screen } from '../sidebar_scenario_helper.js'

Then('the sidebar agent rows shall remain:', { timeout: 15000 }, async function (table) {
  const expected = new Map(table.hashes().map(row => [row.agent, Number(row.cost)]))
  assert.ok(await rowsRemain(() => screen(this), expected),
    `rows changed after the old read completed; last screen:\n${screen(this)}`)
})
