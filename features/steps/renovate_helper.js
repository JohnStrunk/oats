import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import JSON5 from 'json5'

export function loadRenovateConfig() {
  let path = new URL('../../.github/renovate.json5', import.meta.url)
  if (!existsSync(path)) path = new URL('../../.github/renovate.json', import.meta.url)
  assert(existsSync(path), `Renovate configuration file not found at ${path}`)
  const data = JSON5.parse(readFileSync(path, 'utf8'))
  assert(data && typeof data === 'object' && !Array.isArray(data), `Expected object in ${path}`)
  return data
}
