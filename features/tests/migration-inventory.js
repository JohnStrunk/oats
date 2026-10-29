import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { generateMessages } from '@cucumber/gherkin'
import { IdGenerator, SourceMediaType } from '@cucumber/messages'

// Parse every current feature independently of the runner's discovery config.
// Pickle locations identify individual outline example rows.
export function currentInventory(root, component) {
  const result = []
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && entry.name.endsWith('.feature')) {
        const uri = relative(root, path).replaceAll('\\', '/')
        const messages = generateMessages(readFileSync(path, 'utf8'), uri,
          SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
          { includePickles: true, includeGherkinDocument: true, newId: IdGenerator.incrementing() })
        for (const message of messages) {
          assert.ok(!message.parseError, `Invalid feature ${uri}: ${message.parseError?.message}`)
          const pickle = message.pickle
          if (!pickle || (component && !pickle.tags.some(tag => tag.name === `@component:${component}`))) continue
          result.push({ uri, line: pickle.location.line, name: pickle.name, steps: pickle.steps.map(s => s.text) })
        }
      }
    }
  }
  visit(join(root, 'features'))
  return result
}

export function assertCompleteInventory(root, actual, component) {
  const expected = currentInventory(root, component)
  assert.equal(actual.length, expected.length, 'Runner discovery omitted or added scenarios')
  for (const entry of expected) {
    const matches = actual.filter(s => s.uri === entry.uri && s.line === entry.line)
    assert.equal(matches.length, 1, `Missing or duplicate scenario ${entry.uri}:${entry.line}`)
    assert.equal(matches[0].name, entry.name)
    const steps = matches[0].steps.filter(step => !step.hidden)
    assert.deepEqual(steps.map(step => step.name), entry.steps, `Changed steps at ${entry.uri}:${entry.line}`)
    for (const step of steps) {
      assert.ok(step.match?.location && !['undefined', 'ambiguous'].includes(step.result?.status),
        `Undefined or ambiguous step at ${entry.uri}:${entry.line}: ${step.name}`)
    }
  }
}
