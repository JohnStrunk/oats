import { Then } from '@cucumber/cucumber'
import { assertRenderedRowsInOrder } from '../sidebar_sorting_helper.js'

Then('the {word} stats cost rows shall appear in this order:', { timeout: 15000 }, async function (stats, table) {
  if (!['Agent', 'Model'].includes(stats)) throw new Error(`unsupported sidebar stats section: ${stats}`)
  const expected = table.hashes().map(({ row, value, marker }) => ({ name: row, value, marker }))
  if (expected.some(row => !['blank', 'e'].includes(row.marker))) throw new Error('invalid expected marker')
  await assertRenderedRowsInOrder(this, stats, expected)
})
