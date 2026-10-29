import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
Then('the configuration shall extend {string}', function (preset) {
  const extensions = this.renovate_config?.extends ?? []
  assert(extensions.includes(preset), `Expected '${preset}' in extends list, got: ${extensions}`)
})
