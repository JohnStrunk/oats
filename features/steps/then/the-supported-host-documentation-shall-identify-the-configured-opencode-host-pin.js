import { Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'

Then('the supported host documentation shall identify the configured OpenCode host pin', function () {
  const pin = this.documented_host_pin
  for (const { name, text } of this.supported_host_docs) {
    const paragraphs = text.split(/\n\s*\n/)
    const supported = paragraphs.find(p => /opencode/i.test(p) && /support|compatib/i.test(p) &&
      (p.includes('.github/tooling/opencode-host/package.json') || p.includes(pin)))
    assert.ok(supported, `${name} does not identify the configured supported OpenCode host version`)
  }
})
