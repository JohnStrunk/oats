import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { checkNodeVersions } from '../node_version_helper.js'

Then('the Node version alignment check shall reject negative controls', function () {
  const ci = version => [{ job: 'test', version }]
  checkNodeVersions('26.13.0', ci('26.13.0'))
  for (const version of ['26', '26.13', '26.12.1', '26.13.1', '26.14.0', '27.13.0', 'latest', '26.13.0-beta.1']) {
    assert.throws(() => checkNodeVersions('26.13.0', ci(version)), `Accepted ${version}`)
  }
  assert.throws(() => checkNodeVersions('26', ci('26.13.0')))
  assert.throws(() => checkNodeVersions('26.13.0', []))
  assert.throws(() => checkNodeVersions('26.13.0', [...ci('26.13.0'), { job: 'lint', version: '26' }]))
  fc.assert(fc.property(fc.nat({ max: 1000 }), fc.nat({ max: 1000 }), (minor, patch) => {
    const version = `26.${minor}.${patch}`
    checkNodeVersions(version, ci(version))
    assert.throws(() => checkNodeVersions(version, ci(`26.${minor}.${patch + 1}`)))
  }))
})
