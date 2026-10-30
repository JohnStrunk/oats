import { Then } from '@cucumber/cucumber'
import { assertHeading, eventually } from '../usage_details_helper.js'

Then('the usage details heading shall show alpha and fixture-model with reported cost {string}', { timeout: 15000 }, async function (amount) {
  const text = await eventually(this, value => value.split('\n').some(line => line.includes('alpha') && line.includes('fixture-model') && line.includes(amount)), `the pair heading must show reported cost ${amount}`)
  assertHeading(text, 'alpha', 'fixture-model', amount)
})
