import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

export function loadMergifyConfig() {
  const path = new URL('../../.github/mergify.yml', import.meta.url)
  let content
  try {
    content = readFileSync(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new assert.AssertionError({ message: `Mergify configuration file not found at ${path}` })
    }
    throw error
  }
  const data = parse(content)
  assert(data && typeof data === 'object' && !Array.isArray(data), `Expected YAML mapping in ${path}`)
  return data
}

export function getDefaultQueueRule(config) {
  const rules = config.queue_rules ?? []
  const rule = rules.find(rule => rule && typeof rule === 'object' && rule.name === 'default')
  assert(rule, `Default queue rule not found in queue_rules: ${JSON.stringify(rules)}`)
  return rule
}
