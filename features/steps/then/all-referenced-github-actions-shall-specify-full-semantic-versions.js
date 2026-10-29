import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
const semver = /^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const sha = /^[0-9a-fA-F]{40}$/
Then('all referenced GitHub Actions shall specify full semantic versions', function () {
  const actions = this.workflow_actions ?? []
  assert(actions.length > 0, 'No workflow actions to verify')
  const failures = []
  for (const { action_ref: actionRef, comment, file, line } of actions) {
    const loc = `${file}:${line}`
    assert(actionRef.includes('@'), `Action reference '${actionRef}' at ${loc} missing '@' separator`)
    const ref = actionRef.slice(actionRef.indexOf('@') + 1)
    if (sha.test(ref)) {
      if (!comment) failures.push(`${loc}: digest '${ref.slice(0, 7)}' missing version comment (# vX.Y.Z)`)
      else if (!semver.test(comment)) failures.push(`${loc}: digest comment '${comment}' is not a full semantic version vX.Y.Z`)
    } else if (!semver.test(ref)) failures.push(`${loc}: action version ref '${ref}' is not a full semantic version vX.Y.Z`)
  }
  assert(!failures.length, `The following GitHub Actions are not specified via full vX.Y.Z:\n${failures.join('\n')}`)
})
