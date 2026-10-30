import assert from 'node:assert/strict'

const exactVersion = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function checkNodeVersions(nvmVersion, ciVersions) {
  const nvm = String(nvmVersion).match(exactVersion)
  assert.ok(nvm, `Expected an exact Node release in .nvmrc: ${nvmVersion}`)
  assert.ok(ciVersions.length > 0, 'No CI setup-node steps found')
  for (const { job, version } of ciVersions) {
    const ci = String(version).match(exactVersion)
    assert.ok(ci, `Expected an exact Node release in CI job ${job}: ${version}`)
    assert.equal(ci.slice(1).join('.'), nvm.slice(1).join('.'),
      `CI job ${job} specifies a different Node release from .nvmrc`)
  }
}
