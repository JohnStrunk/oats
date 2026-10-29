import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the docker package rule shall nullify the minimum release age', function () {
  const rule = this.docker_rule ?? {}
  assert(Object.hasOwn(rule, 'minimumReleaseAge'), `Rule does not specify 'minimumReleaseAge': ${JSON.stringify(rule)}`)
  assert.equal(rule.minimumReleaseAge, null, `Expected minimumReleaseAge to be null, got ${rule.minimumReleaseAge}`)
})
