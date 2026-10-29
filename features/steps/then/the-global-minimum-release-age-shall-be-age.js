import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the global minimum release age shall be {string}', function (age) {
  const actual = this.renovate_config?.minimumReleaseAge
  assert.equal(actual, age, `Expected global minimumReleaseAge '${age}', got '${actual}'`)
})
