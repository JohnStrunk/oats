import assert from 'node:assert/strict'
import { Then } from '@cucumber/cucumber'

Then('the plugin shall contribute to a session sidebar slot', function () {
  const placements = ['append', 'prepend', 'before', 'after', 'replace']
  assert.ok(this.sidebarHost.claims.some(claim =>
    placements.some(key => ['sidebar.content', 'sidebar.footer'].includes(claim[key])) &&
    typeof claim.render === 'function'),
  'the actual plugin did not register a renderable session sidebar contribution')
})
